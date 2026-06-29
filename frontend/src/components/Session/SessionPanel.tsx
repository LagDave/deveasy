import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import { useActiveProject } from "../../hooks/queries/useProjects";
import { useCreateSession, useSessions } from "../../hooks/queries/useSessionHistory";
import { useSession } from "../../hooks/useSession";
import { toast } from "../../lib/toast";
import { SessionComposer } from "./SessionComposer";
import { SessionTranscript } from "./SessionTranscript";

/**
 * Self-contained Sessions panel mounted in the app shell. Picks the active
 * project, lets the operator open/create a chat session, and renders the live
 * streaming transcript. Data-fetching lives in hooks (Constitution §14.3); errors
 * surface via toast (§16.3).
 */
export function SessionPanel() {
  const { data: active } = useActiveProject();
  const projectId = active?.id ?? null;

  const { data: sessions, isLoading, error } = useSessions(projectId);
  const createSession = useCreateSession();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  // Default the selection to the most recent session for the project.
  useEffect(() => {
    if (activeSessionId === null && sessions && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const { events, status, send } = useSession(activeSessionId);

  const onNewSession = () => {
    if (!projectId) return;
    createSession.mutate(
      { projectId },
      {
        onSuccess: (session) => setActiveSessionId(session.id),
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Could not start a session"),
      },
    );
  };

  if (!projectId) {
    return <p className="muted">Select a project first to start a session.</p>;
  }
  if (isLoading) return <p className="muted">Loading sessions…</p>;
  if (error) {
    return (
      <p className="error">
        {error instanceof ApiError ? error.message : "Failed to load sessions"}
      </p>
    );
  }

  return (
    <div className="session-panel">
      <div className="session-toolbar">
        <select
          value={activeSessionId ?? ""}
          onChange={(e) => setActiveSessionId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select a session…</option>
          {(sessions ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title ?? `Session #${s.id}`} · {s.status}
            </option>
          ))}
        </select>
        <button onClick={onNewSession} disabled={createSession.isPending}>
          New session
        </button>
        {activeSessionId && <span className={`session-status ${status}`}>{status}</span>}
      </div>

      {activeSessionId ? (
        <>
          <SessionTranscript events={events} />
          <SessionComposer onSend={send} disabled={status !== "open"} />
        </>
      ) : (
        <p className="muted">Open a session or start a new one to chat with Claude.</p>
      )}
    </div>
  );
}
