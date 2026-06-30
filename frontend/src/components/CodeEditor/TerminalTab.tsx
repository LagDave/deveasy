import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api";
import { useCreateTerminal, useKillTerminal, useTerminals } from "../../hooks/queries/useTerminals";
import { toast } from "../../lib/toast";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { TerminalPane } from "./terminal/TerminalPane";
import {
  collectLeafIds,
  pruneToLive,
  removeLeaf,
  splitLeaf,
  type Pane,
  type SplitDir,
  type TermTab,
} from "./terminal/terminalLayout";

/**
 * The TERMINAL tab. Each tab holds a split tree of PTYs (group terminals side by
 * side / stacked); tab names are editable; the whole layout is persisted to
 * localStorage so grouping + names survive a reload (the PTYs persist on the
 * backend independently). On mount we hydrate the saved layout and reconcile it
 * once against the live PTY list — pruning dead panes, adopting orphans (§15.2).
 */
interface Props {
  projectId: number;
}

interface Persisted {
  tabs: TermTab[];
  seq: number;
}

const storageKey = (projectId: number) => `deveasy:terminals:${projectId}`;

function loadPersisted(projectId: number): Persisted | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

export function TerminalTab({ projectId }: Props) {
  const { data, isLoading } = useTerminals(projectId);
  const createTerminal = useCreateTerminal(projectId);
  const killTerminal = useKillTerminal(projectId);

  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const seqRef = useRef(0);
  const hydratedRef = useRef(false);
  const reconciledRef = useRef(false);
  // PTYs created this mount — never prune these even if the live list lags behind.
  const createdRef = useRef<Set<string>>(new Set());

  // Hydrate the saved layout once.
  if (!hydratedRef.current) {
    hydratedRef.current = true;
    const persisted = loadPersisted(projectId);
    if (persisted) {
      seqRef.current = persisted.seq ?? persisted.tabs.length;
    }
  }

  // Persist on every change (after hydrate).
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify({ tabs, seq: seqRef.current }));
    } catch {
      // storage full / unavailable — non-fatal, layout just won't persist
    }
  }, [tabs, projectId]);

  // Reconcile the saved layout against live PTYs exactly once, after they load.
  useEffect(() => {
    if (reconciledRef.current || !data) return;
    reconciledRef.current = true;

    const live = new Set(data.terminals.map((t) => t.id));
    const keep = new Set([...live, ...createdRef.current]);
    const persisted = loadPersisted(projectId);

    const pruned: TermTab[] = (persisted?.tabs ?? [])
      .map((tab) => ({ ...tab, layout: pruneToLive(tab.layout, keep) }))
      .filter((tab): tab is TermTab => tab.layout !== null);

    const known = new Set(pruned.flatMap((tab) => collectLeafIds(tab.layout)));
    const orphans = data.terminals.filter((t) => !known.has(t.id));
    const adopted: TermTab[] = orphans.map((t) => ({
      id: crypto.randomUUID(),
      name: `Terminal ${(seqRef.current += 1)}`,
      layout: { type: "leaf", terminalId: t.id },
    }));

    const next = [...pruned, ...adopted];
    setTabs(next);
    setActiveTabId((cur) => (cur && next.some((t) => t.id === cur) ? cur : (next[0]?.id ?? null)));
  }, [data, projectId]);

  const onError = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const updateTab = (tabId: string, layout: Pane | null) => {
    setTabs((prev) => {
      if (layout === null) {
        const next = prev.filter((t) => t.id !== tabId);
        setActiveTabId((cur) => (cur === tabId ? (next[0]?.id ?? null) : cur));
        return next;
      }
      return prev.map((t) => (t.id === tabId ? { ...t, layout } : t));
    });
  };

  const addTab = () => {
    createTerminal.mutate(undefined, {
      onSuccess: (t) => {
        createdRef.current.add(t.id);
        const tab: TermTab = {
          id: crypto.randomUUID(),
          name: `Terminal ${(seqRef.current += 1)}`,
          layout: { type: "leaf", terminalId: t.id },
        };
        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
      },
      onError: (e) => onError(e, "Could not start a terminal"),
    });
  };

  const splitPane = (tabId: string, targetTerminalId: string, dir: SplitDir) => {
    createTerminal.mutate(undefined, {
      onSuccess: (t) => {
        createdRef.current.add(t.id);
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? { ...tab, layout: splitLeaf(tab.layout, targetTerminalId, dir, t.id) }
              : tab,
          ),
        );
      },
      onError: (e) => onError(e, "Could not split the terminal"),
    });
  };

  const closePane = (tabId: string, terminalId: string) => {
    killTerminal.mutate(terminalId, { onError: (e) => onError(e, "Could not close the terminal") });
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) updateTab(tabId, removeLeaf(tab.layout, terminalId));
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      for (const id of collectLeafIds(tab.layout)) {
        killTerminal.mutate(id, { onError: (e) => onError(e, "Could not close the terminal") });
      }
    }
    updateTab(tabId, null);
  };

  const startRename = (tab: TermTab) => {
    setEditingId(tab.id);
    setDraftName(tab.name);
  };
  const commitRename = () => {
    if (editingId) {
      const name = draftName.trim();
      if (name) setTabs((prev) => prev.map((t) => (t.id === editingId ? { ...t, name } : t)));
    }
    setEditingId(null);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <Spinner label="Loading terminals" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-stretch overflow-x-auto border-b border-line bg-surface">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const editing = tab.id === editingId;
          return (
            <div
              key={tab.id}
              className={`group flex items-center gap-2 border-r border-line px-3 py-2 text-xs ${
                active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60"
              }`}
            >
              <Icon name="terminal" size={13} className={active ? "text-accent" : ""} />
              {editing ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-28 rounded border border-line-strong bg-bg px-1 py-0.5 font-mono text-xs text-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  onDoubleClick={() => startRename(tab)}
                  title="Double-click to rename"
                  className="font-mono"
                >
                  {tab.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => closeTab(tab.id)}
                className="grid h-4 w-4 place-items-center rounded text-faint opacity-0 hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
                title="Close tab"
                aria-label={`Close ${tab.name}`}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addTab}
          disabled={createTerminal.isPending}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted hover:bg-surface-2/60 hover:text-ink"
          title="New terminal"
        >
          <Icon name="add" size={14} />
          {createTerminal.isPending ? "Starting…" : "New"}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {!activeTab ? (
          <div className="grid h-full place-items-center px-6">
            <EmptyState
              icon={<Icon name="terminal" size={26} />}
              title="No terminals yet"
              hint="Start a terminal to run commands in this project. Use the corner icons to split a terminal side by side or stacked."
            />
          </div>
        ) : (
          tabs.map((tab) => (
            <div key={tab.id} className={tab.id === activeTabId ? "h-full" : "hidden"}>
              {tab.id === activeTabId && (
                <TerminalPane
                  pane={tab.layout}
                  onSplit={(terminalId, dir) => splitPane(tab.id, terminalId, dir)}
                  onClose={(terminalId) => closePane(tab.id, terminalId)}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
