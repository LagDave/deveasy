import { motion } from "framer-motion";
import { useState } from "react";
import type { GitStatusFile } from "../../api/git";
import type { Session, SessionRuntime } from "../../api/sessions";
import { useGitStatus } from "../../hooks/queries/useGit";
import type { Project } from "../../types";
import type { WorkspaceTab } from "../CodeEditor/WorkspaceTabs";
import { useConfirm } from "../ui/confirm";
import { Icon } from "../ui/Icon";
import { fadeUp, staggerContainer } from "../ui/motion";
import { BranchPicker } from "./BranchPicker";
import { UsageRing } from "./UsageRing";

/** localStorage key holding the ids of projects whose session lists are collapsed. */
const COLLAPSED_PROJECTS_KEY = "deveasy:sidebar-collapsed-projects";

/** Read the collapsed-project id set from localStorage; tolerant of missing/corrupt data. */
function loadCollapsedProjects(): Set<number> {
  try {
    const raw = localStorage.getItem(COLLAPSED_PROJECTS_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : []);
  } catch {
    return new Set();
  }
}

/** Persist the collapsed-project id set; storage failures (private mode) are non-fatal. */
function saveCollapsedProjects(ids: Set<number>): void {
  try {
    localStorage.setItem(COLLAPSED_PROJECTS_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable (e.g. private mode) — the toggle still works in-memory for this session.
  }
}

/**
 * Left rail of the Sessions panel: every project is a group, its sessions listed
 * beneath with a running indicator. Sessions can be renamed inline or deleted.
 * Each project group can be collapsed; the choice is remembered in localStorage.
 */
interface Props {
  projects: Project[];
  sessions: Session[];
  activeSessionId: number | null;
  creatingProjectId: number | null;
  onSelect: (sessionId: number) => void;
  onNewSession: (projectId: number) => void;
  onOpenEditor: (projectId: number, tab?: WorkspaceTab) => void;
  onRename: (sessionId: number, title: string) => void;
  onDelete: (sessionId: number) => void;
}

export function SessionSidebar(props: Props) {
  const { projects, sessions, creatingProjectId, onNewSession, onOpenEditor } = props;
  const byProject = (projectId: number) => sessions.filter((s) => s.project_id === projectId);

  const [collapsed, setCollapsed] = useState<Set<number>>(loadCollapsedProjects);

  const toggleCollapsed = (projectId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      saveCollapsedProjects(next);
      return next;
    });
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-line">
      <UsageRing />
      <div className="border-b border-line px-4 py-3">
        <p className="eyebrow">Sessions by project</p>
      </div>

      {projects.length === 0 && (
        <p className="px-4 py-4 text-sm text-muted">No projects yet — add one in Projects.</p>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-1 p-2">
        {projects.map((project) => {
          const list = byProject(project.id);
          const isCollapsed = collapsed.has(project.id);
          return (
            <motion.div key={project.id} variants={fadeUp} className="mb-1">
              <div className="px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleCollapsed(project.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    title={isCollapsed ? `Expand ${project.name}` : `Collapse ${project.name}`}
                    aria-expanded={!isCollapsed}
                  >
                    <Icon
                      name={isCollapsed ? "chevronRight" : "chevronDown"}
                      size={14}
                      className="shrink-0 text-faint"
                    />
                    <span className="truncate font-mono text-xs font-semibold text-muted">{project.name}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => onOpenEditor(project.id)}
                      className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
                      title={`Open files for ${project.name}`}
                    >
                      <Icon name="folder" size={14} />
                    </button>
                    <button
                      onClick={() => onOpenEditor(project.id, "repo")}
                      className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
                      title={`Open repo for ${project.name}`}
                    >
                      <Icon name="branch" size={14} />
                    </button>
                    <button
                      onClick={() => onOpenEditor(project.id, "terminal")}
                      className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
                      title={`Open terminal for ${project.name}`}
                    >
                      <Icon name="terminal" size={14} />
                    </button>
                    <button
                      onClick={() => onNewSession(project.id)}
                      disabled={creatingProjectId === project.id}
                      className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink disabled:opacity-50"
                      title={`New session in ${project.name}`}
                    >
                      <Icon name="add" size={14} />
                    </button>
                  </div>
                </div>
                {!isCollapsed && <ProjectGitInfo projectId={project.id} />}
              </div>

              {!isCollapsed &&
                (list.length === 0 ? (
                  <p className="px-2 pb-1 text-xs text-faint">No sessions yet</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                    {list.map((s) => (
                      <SessionRow key={s.id} session={s} active={s.id === props.activeSessionId} {...props} />
                    ))}
                  </ul>
                ))}
            </motion.div>
          );
        })}
      </motion.div>
    </aside>
  );
}

/**
 * Bucket porcelain status codes into the three counts shown in the sidebar.
 * Each file appears on one status line, so it lands in exactly one bucket
 * (priority: new → deleted → modified). `??` is untracked, "A" is a staged add.
 */
function summarizeStatus(files: GitStatusFile[]) {
  let added = 0;
  let modified = 0;
  let deleted = 0;
  for (const { state } of files) {
    if (state === "??" || state.includes("A")) added += 1;
    else if (state.includes("D")) deleted += 1;
    else modified += 1;
  }
  return { added, modified, deleted };
}

/** Compact git line under a project name: truncated branch + new/modified/deleted counts. */
function ProjectGitInfo({ projectId }: { projectId: number }) {
  const { data } = useGitStatus(projectId);
  if (!data) return null;
  const { added, modified, deleted } = summarizeStatus(data.files);

  return (
    <div className="mt-1 flex items-center gap-2 pl-0.5 text-[10px] text-faint">
      <BranchPicker projectId={projectId} current={data.branch} />
      <span className="flex shrink-0 items-center gap-1.5 font-mono">
        {added > 0 && <span className="text-success" title={`${added} new`}>+{added}</span>}
        {modified > 0 && <span className="text-accent" title={`${modified} modified`}>~{modified}</span>}
        {deleted > 0 && <span className="text-danger" title={`${deleted} deleted`}>-{deleted}</span>}
        {data.isClean && <span>clean</span>}
      </span>
    </div>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  onRename,
  onDelete,
}: { session: Session; active: boolean } & Pick<Props, "onSelect" | "onRename" | "onDelete">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const confirm = useConfirm();
  const label = session.title ?? "New Session";
  const runtime = session.runtime ?? null;

  const requestDelete = async () => {
    const ok = await confirm({
      title: "Delete session?",
      message: `"${label}" and its transcript will be permanently removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) onDelete(session.id);
  };

  if (editing) {
    const commit = () => {
      const t = draft.trim();
      if (t) onRename(session.id, t);
      setEditing(false);
    };
    return (
      <li className="px-1 py-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          className="field !py-1.5 text-sm"
        />
      </li>
    );
  }

  return (
    <li className="group relative">
      <button
        onClick={() => onSelect(session.id)}
        className={`flex w-full items-center gap-2.5 rounded-md py-2 pl-2.5 pr-16 text-left transition-colors ${
          active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"
        }`}
      >
        <RuntimeDot runtime={runtime} />
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        {runtime === "idle" && <span className="eyebrow !text-success">ready</span>}
      </button>
      <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
        <button
          className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
          title="Rename"
          onClick={() => {
            setDraft(label);
            setEditing(true);
          }}
        >
          <Icon name="rename" size={14} />
        </button>
        <button
          className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-danger"
          title="Delete"
          onClick={() => void requestDelete()}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>
    </li>
  );
}

function RuntimeDot({ runtime }: { runtime: SessionRuntime }) {
  // Fixed-width, centered slot so the title never shifts between states.
  const slot = "flex h-2 w-4 shrink-0 justify-center";
  if (runtime === null)
    return (
      <span className={`${slot} items-center`}>
        <span className="h-2 w-2 rounded-full bg-faint" />
      </span>
    );
  if (runtime === "idle")
    return (
      <span className={`${slot} items-center`}>
        <span className="h-2 w-2 rounded-full bg-success" />
      </span>
    );
  // working: a subtle "typing" indicator — three amber dots bouncing in sequence.
  return (
    <span className={`${slot} items-end gap-0.5`} aria-label="working">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-[3px] w-[3px] rounded-full bg-accent"
          animate={{ y: [0, -1.5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut", delay: i * 0.075 }}
        />
      ))}
    </span>
  );
}
