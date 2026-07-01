import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import {
  useCloseSessionTerminal,
  useCreateSessionTerminal,
  useSessionTerminals,
} from "../../hooks/queries/useSessionTerminals";
import { toast } from "../../lib/toast";
import { TerminalInstance } from "../CodeEditor/terminal/TerminalInstance";
import { Icon } from "../ui/Icon";

/**
 * Session terminal strip: a thin tab row (one chip per session terminal) over the
 * active PTY. The list is the server's `listBySession` (a session terminal shows here
 * and in the project TERMINAL tab); rendering reuses the editor's TerminalInstance +
 * useTerminalSocket verbatim (§14.3 — no new terminal rendering). "+" creates one in
 * the session's project; the × closes one. Kept lean — logic stays in the hook (§13.1).
 */
interface Props {
  sessionId: number;
  projectId: number;
}

export function SessionTerminals({ sessionId, projectId }: Props) {
  const { data } = useSessionTerminals(sessionId);
  const createTerminal = useCreateSessionTerminal(sessionId);
  const closeTerminal = useCloseSessionTerminal(sessionId);

  const terminals = data?.terminals ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep a valid active tab as the (per-session) list changes: default to the first,
  // and when the active one is closed fall back to whatever remains.
  useEffect(() => {
    setActiveId((cur) => {
      if (cur && terminals.some((t) => t.id === cur)) return cur;
      return terminals[0]?.id ?? null;
    });
  }, [terminals]);

  const onError = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const addTerminal = () => {
    createTerminal.mutate(projectId, {
      onSuccess: (t) => setActiveId(t.id),
      onError: (e) => onError(e, "Could not start a terminal"),
    });
  };

  const removeTerminal = (id: string) => {
    closeTerminal.mutate(id, { onError: (e) => onError(e, "Could not close the terminal") });
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-[#0b0b0b]">
      <div className="flex items-stretch overflow-x-auto border-b border-line">
        {terminals.map((t, i) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex h-9 shrink-0 items-center gap-2 border-r border-line px-3 text-xs ${
                active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60"
              }`}
            >
              <Icon name="terminal" size={13} className={active ? "text-accent" : ""} />
              <button type="button" onClick={() => setActiveId(t.id)} className="font-mono">
                {`Terminal ${i + 1}`}
              </button>
              <button
                type="button"
                onClick={() => removeTerminal(t.id)}
                className="grid h-4 w-4 place-items-center rounded text-faint opacity-0 hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
                title="Close terminal"
                aria-label={`Close terminal ${i + 1}`}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addTerminal}
          disabled={createTerminal.isPending}
          className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-xs text-muted hover:bg-surface-2/60 hover:text-ink"
          title="New terminal"
        >
          <Icon name="add" size={14} />
          {createTerminal.isPending ? "Starting…" : "New"}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {terminals.map((t) => (
          <div key={t.id} className={t.id === activeId ? "h-full" : "hidden"}>
            {t.id === activeId && <TerminalInstance terminalId={t.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
