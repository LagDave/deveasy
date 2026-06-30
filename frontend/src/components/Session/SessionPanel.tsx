import { useState } from "react";
import { ApiError } from "../../api";
import { useProjects } from "../../hooks/queries/useProjects";
import {
  useAllSessions,
  useCreateSession,
  useDeleteSession,
  useRenameSession,
  useStopSession,
} from "../../hooks/queries/useSessionHistory";
import { useSession } from "../../hooks/useSession";
import { toast } from "../../lib/toast";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { SessionComposer } from "./SessionComposer";
import { SessionSidebar } from "./SessionSidebar";
import { SessionTranscript } from "./SessionTranscript";

const STATUS_PILL: Record<string, string> = {
  open: "pill-success",
  connecting: "pill-accent",
  closed: "pill",
  error: "pill-danger",
};

/**
 * Sessions panel: a project-grouped session rail on the left, the live
 * conversation on the right. Starting a session is picking a project's "+" — no
 * need to switch the global active project.
 */
export function SessionPanel() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: sessions, isLoading: sessionsLoading } = useAllSessions();
  const createSession = useCreateSession();
  const stopSession = useStopSession();
  const renameSession = useRenameSession();
  const deleteSession = useDeleteSession();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [creatingProjectId, setCreatingProjectId] = useState<number | null>(null);

  const onRename = (sessionId: number, title: string) => {
    renameSession.mutate(
      { sessionId, title },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not rename") },
    );
  };

  const onDelete = (sessionId: number) => {
    deleteSession.mutate(sessionId, {
      onSuccess: () => {
        if (sessionId === activeSessionId) setActiveSessionId(null);
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not delete"),
    });
  };

  const { events, status, send, streaming, partialText } = useSession(activeSessionId);
  const activeSession = sessions?.find((s) => s.id === activeSessionId) ?? null;

  const onNewSession = (projectId: number) => {
    setCreatingProjectId(projectId);
    createSession.mutate(
      { projectId },
      {
        onSuccess: (session) => setActiveSessionId(session.id),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not start a session"),
        onSettled: () => setCreatingProjectId(null),
      },
    );
  };

  if (projectsLoading || sessionsLoading) {
    return <div className="px-8 py-7"><Spinner label="Loading sessions" /></div>;
  }

  return (
    <div className="flex h-full">
      <SessionSidebar
        projects={projects ?? []}
        sessions={sessions ?? []}
        activeSessionId={activeSessionId}
        creatingProjectId={creatingProjectId}
        onSelect={setActiveSessionId}
        onNewSession={onNewSession}
        onRename={onRename}
        onDelete={onDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {activeSessionId ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3">
              <span className="truncate font-mono text-sm text-muted">
                {activeSession?.title ?? `Session #${activeSessionId}`}
              </span>
              <div className="flex items-center gap-2">
                <span className={`pill ${STATUS_PILL[status] ?? "pill"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {streaming ? "responding" : status}
                </span>
                {activeSession?.runtime && (
                  <button
                    className="btn btn-danger"
                    disabled={stopSession.isPending}
                    onClick={() => stopSession.mutate(activeSessionId)}
                    title="End this session's process"
                  >
                    <Icon name="close" size={15} />
                    End session
                  </button>
                )}
              </div>
            </div>
            <SessionTranscript key={activeSessionId} events={events} thinking={streaming} partialText={partialText} />
            <SessionComposer
              onSend={send}
              disabled={status !== "open" || streaming}
              hint={
                status !== "open"
                  ? "Connecting to the session…"
                  : streaming
                    ? "Claude is responding…"
                    : "Enter to send · Shift+Enter for a new line"
              }
            />
          </>
        ) : (
          <div className="flex-1 px-8 py-7">
            <EmptyState
              icon={<Icon name="sessions" size={26} />}
              title="Pick or start a session"
              hint="Choose a session from the left, or hit + next to any project to start a new one."
            />
          </div>
        )}
      </div>
    </div>
  );
}
