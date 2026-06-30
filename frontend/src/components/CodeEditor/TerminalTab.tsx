import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import { useCreateTerminal, useKillTerminal, useTerminals } from "../../hooks/queries/useTerminals";
import { toast } from "../../lib/toast";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { TerminalInstance } from "./terminal/TerminalInstance";

/**
 * The TERMINAL tab: multiple PTY terminals for the open project. The PTYs live in
 * the backend for the server's lifetime, so on mount we list the project's live
 * terminals and reattach (a browser reload restores them with their scrollback).
 * Instances stay mounted (hidden when inactive) so switching between them keeps
 * each xterm view alive. Server state is React Query; only the active id is local
 * UI state (§15.1, §15.2).
 */
interface Props {
  projectId: number;
}

export function TerminalTab({ projectId }: Props) {
  const { data, isLoading } = useTerminals(projectId);
  const createTerminal = useCreateTerminal(projectId);
  const killTerminal = useKillTerminal(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);

  const terminals = data?.terminals ?? [];

  // Keep the active selection valid as terminals appear/disappear.
  useEffect(() => {
    if (terminals.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !terminals.some((t) => t.id === activeId)) {
      setActiveId(terminals[0].id);
    }
  }, [terminals, activeId]);

  const onError = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const addTerminal = () => {
    createTerminal.mutate(undefined, {
      onSuccess: (t) => setActiveId(t.id),
      onError: (e) => onError(e, "Could not start a terminal"),
    });
  };

  const closeTerminal = (id: string) => {
    killTerminal.mutate(id, { onError: (e) => onError(e, "Could not close the terminal") });
  };

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <Spinner label="Loading terminals" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-stretch border-b border-line bg-surface">
        {terminals.map((t, i) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-2 border-r border-line px-3 py-2 text-xs ${
                active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveId(t.id)}
                className="flex items-center gap-1.5 font-mono"
              >
                <Icon name="terminal" size={13} className={active ? "text-accent" : ""} />
                Terminal {i + 1}
              </button>
              <button
                type="button"
                onClick={() => closeTerminal(t.id)}
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
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted hover:bg-surface-2/60 hover:text-ink"
          title="New terminal"
        >
          <Icon name="add" size={14} />
          {createTerminal.isPending ? "Starting…" : "New"}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {terminals.length === 0 ? (
          <div className="grid h-full place-items-center px-6">
            <EmptyState
              icon={<Icon name="terminal" size={26} />}
              title="No terminals yet"
              hint="Start a terminal to run commands in this project."
            />
          </div>
        ) : (
          terminals.map((t) => (
            <div key={t.id} className={t.id === activeId ? "h-full" : "hidden"}>
              <TerminalInstance terminalId={t.id} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
