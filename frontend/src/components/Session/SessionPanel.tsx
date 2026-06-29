import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import { useActiveProject } from "../../hooks/queries/useProjects";
import { useCreateSession, useSessions } from "../../hooks/queries/useSessionHistory";
import { useSession } from "../../hooks/useSession";
import { toast } from "../../lib/toast";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { SessionComposer } from "./SessionComposer";
import { SessionTranscript } from "./SessionTranscript";

const STATUS_PILL: Record<string, string> = {
  open: "pill-success",
  connecting: "pill-accent",
  closed: "pill",
  error: "pill-danger",
};

/**
 * Sessions panel: pick or start a chat session against the active project and
 * stream the conversation. Full-height layout — toolbar, scrolling transcript,
 * pinned composer.
 */
export function SessionPanel() {
  const { data: active } = useActiveProject();
  const projectId = active?.id ?? null;

  const { data: sessions, isLoading, error } = useSessions(projectId);
  const createSession = useCreateSession();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  useEffect(() => {
    if (activeSessionId === null && sessions && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const { events, status, send, streaming } = useSession(activeSessionId);

  const onNewSession = () => {
    if (!projectId) return;
    createSession.mutate(
      { projectId },
      {
        onSuccess: (session) => setActiveSessionId(session.id),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not start a session"),
      },
    );
  };

  if (!projectId) {
    return (
      <div className="h-full px-8 py-7">
        <EmptyState icon="▤" title="No active project" hint="Select a project first, then start a session here." />
      </div>
    );
  }
  if (isLoading) {
    return <div className="px-8 py-7"><Spinner label="Loading sessions" /></div>;
  }
  if (error) {
    return (
      <div className="px-8 py-7">
        <p className="text-sm text-danger">{error instanceof ApiError ? error.message : "Failed to load sessions"}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b border-line px-6 py-3">
        <select
          value={activeSessionId ?? ""}
          onChange={(e) => setActiveSessionId(e.target.value ? Number(e.target.value) : null)}
          className="field max-w-xs font-mono text-xs"
        >
          <option value="">Select a session…</option>
          {(sessions ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title ?? `Session #${s.id}`} · {s.status}
            </option>
          ))}
        </select>
        <button onClick={onNewSession} disabled={createSession.isPending} className="btn btn-primary">
          + New session
        </button>
        {activeSessionId && (
          <span className={`pill ${STATUS_PILL[status] ?? "pill"} ml-auto`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {status}
          </span>
        )}
      </div>

      {activeSessionId ? (
        <>
          <SessionTranscript events={events} thinking={streaming} />
          <SessionComposer
            onSend={send}
            disabled={status !== "open" || streaming}
            hint={
              status !== "open"
                ? "Reconnecting to the session…"
                : streaming
                  ? "Claude is responding…"
                  : "Enter to send · Shift+Enter for a new line"
            }
          />
        </>
      ) : (
        <div className="flex-1 px-8 py-7">
          <EmptyState
            icon="▤"
            title="Start a conversation"
            hint="Open an existing session above, or start a new one to chat with Claude in this project."
            action={
              <button onClick={onNewSession} disabled={createSession.isPending} className="btn btn-primary">
                + New session
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
