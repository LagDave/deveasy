import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api";
import { useProjects } from "../../hooks/queries/useProjects";
import {
  useAllSessions,
  useCreateSession,
  useDeleteSession,
  useRenameSession,
} from "../../hooks/queries/useSessionHistory";
import { useSession } from "../../hooks/useSession";
import { toast } from "../../lib/toast";
import { getLastEffort, getLastModel } from "../../utils/modelLabels";
import type { WorkspaceTab } from "../CodeEditor/WorkspaceTabs";
import { WizardChoice } from "../CreateProject/WizardChoice";
import { buildSeedTurn, parseWizardQuestion } from "../CreateProject/wizardProtocol";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { SessionComposer } from "./SessionComposer";
import { flattenEvents, skillLoadName } from "./sessionEvents";
import { SessionSidebar } from "./SessionSidebar";
import { SessionTranscript } from "./SessionTranscript";

/** A session the panel should open and (if fresh) seed the wizard turn into. */
export interface OpenSessionRequest {
  id: number;
  projectName: string;
}

// Lazy so Monaco (~heavy) is only fetched when the editor takeover is opened,
// keeping the initial Sessions bundle lean.
const CodeEditorView = lazy(() =>
  import("../CodeEditor/CodeEditorView").then((m) => ({ default: m.CodeEditorView })),
);

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
export function SessionPanel({
  openSession,
  onOpenConsumed,
}: {
  /** A session to open (e.g. just created via the project wizard); seeded once. */
  openSession?: OpenSessionRequest | null;
  onOpenConsumed?: () => void;
} = {}) {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: sessions, isLoading: sessionsLoading } = useAllSessions();
  const createSession = useCreateSession();
  const renameSession = useRenameSession();
  const deleteSession = useDeleteSession();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [creatingProjectId, setCreatingProjectId] = useState<number | null>(null);
  const [editorProjectId, setEditorProjectId] = useState<number | null>(null);
  const [editorTab, setEditorTab] = useState<WorkspaceTab>("files");
  const seededRef = useRef<Set<number>>(new Set());

  // Open the editor takeover for a project, optionally on a specific tab (Repo/Terminal
  // shortcuts from the sidebar). Defaults to Files, matching the plain folder button.
  const openEditor = (projectId: number, tab: WorkspaceTab = "files") => {
    setEditorTab(tab);
    setEditorProjectId(projectId);
  };

  // Open a session handed in from elsewhere (the create-project wizard).
  useEffect(() => {
    if (openSession && openSession.id !== activeSessionId) setActiveSessionId(openSession.id);
  }, [openSession, activeSessionId]);

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

  const {
    events,
    status,
    send,
    isReady,
    streaming,
    partialText,
    selectedModel,
    resolvedModel,
    selectedEffort,
    slashCommands,
    context,
    setModel,
    setEffort,
    queue,
    updateQueued,
    removeQueued,
    clearQueue,
  } = useSession(activeSessionId);
  const activeSession = sessions?.find((s) => s.id === activeSessionId) ?? null;

  // Seed the create-project session's opening turn once the CLI process is ready
  // (isReady, not just ws-open — the backend wires its message handler and starts
  // the process inside attach(), and a turn sent before that is dropped). Clear the
  // request afterward so re-entering Sessions never re-seeds.
  useEffect(() => {
    if (!openSession || activeSessionId !== openSession.id || !isReady) return;
    if (seededRef.current.has(openSession.id)) return;
    seededRef.current.add(openSession.id);
    send(buildSeedTurn(openSession.projectName));
    onOpenConsumed?.();
  }, [openSession, activeSessionId, isReady, send, onOpenConsumed]);

  // When the latest assistant turn carries a deveasy-question, offer it as buttons.
  // Self-gating: normal sessions never emit these blocks, so nothing changes there.
  const items = useMemo(() => flattenEvents(events), [events]);
  const lastAssistantText = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      if (it.kind === "text" && it.role === "assistant" && !skillLoadName(it.text)) return it.text;
    }
    return null;
  }, [items]);
  const wizardQuestion = !streaming && lastAssistantText ? parseWizardQuestion(lastAssistantText) : null;

  const onNewSession = (projectId: number) => {
    setCreatingProjectId(projectId);
    // New sessions open on the last model + effort the operator picked (their default).
    createSession.mutate(
      { projectId, model: getLastModel(), effort: getLastEffort() },
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

  if (editorProjectId !== null) {
    const editorProject = projects?.find((p) => p.id === editorProjectId);
    return (
      <Suspense fallback={<div className="px-8 py-7"><Spinner label="Loading editor" /></div>}>
        <CodeEditorView
          projectId={editorProjectId}
          projectName={editorProject?.name ?? `Project #${editorProjectId}`}
          initialTab={editorTab}
          onBack={() => setEditorProjectId(null)}
        />
      </Suspense>
    );
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
        onOpenEditor={openEditor}
        onRename={onRename}
        onDelete={onDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {activeSessionId ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3">
              <span className="truncate font-mono text-sm text-muted">
                {activeSession?.title ?? "New Session"}
              </span>
              {(streaming || status !== "open") && (
                <span className={`pill ${STATUS_PILL[status] ?? "pill"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {streaming ? "responding" : status}
                </span>
              )}
            </div>
            <SessionTranscript key={activeSessionId} events={events} thinking={streaming} partialText={partialText} />
            {wizardQuestion && status === "open" && (
              <div className="border-t border-line px-6 py-3">
                <WizardChoice key={wizardQuestion.id} question={wizardQuestion} onSubmit={send} />
              </div>
            )}
            <SessionComposer
              onSend={send}
              disabled={status !== "open"}
              busy={streaming}
              selectedModel={selectedModel}
              resolvedModel={resolvedModel}
              selectedEffort={selectedEffort}
              slashCommands={slashCommands}
              context={context}
              onSetModel={setModel}
              onSetEffort={setEffort}
              queue={queue}
              onUpdateQueued={updateQueued}
              onRemoveQueued={removeQueued}
              onClearQueue={clearQueue}
              hint={status !== "open" ? "Connecting to the session…" : undefined}
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
