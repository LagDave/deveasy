import { motion } from "framer-motion";
import { useState } from "react";
import type { Session, SessionRuntime } from "../../api/sessions";
import type { Project } from "../../types";
import { useConfirm } from "../ui/confirm";
import { fadeUp, staggerContainer } from "../ui/motion";

/**
 * Left rail of the Sessions panel: every project is a group, its sessions listed
 * beneath with a running indicator. Sessions can be renamed inline or deleted.
 */
interface Props {
  projects: Project[];
  sessions: Session[];
  activeSessionId: number | null;
  creatingProjectId: number | null;
  onSelect: (sessionId: number) => void;
  onNewSession: (projectId: number) => void;
  onRename: (sessionId: number, title: string) => void;
  onDelete: (sessionId: number) => void;
}

export function SessionSidebar(props: Props) {
  const { projects, sessions, creatingProjectId, onNewSession } = props;
  const byProject = (projectId: number) => sessions.filter((s) => s.project_id === projectId);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-line">
      <div className="border-b border-line px-4 py-3">
        <p className="eyebrow">Sessions by project</p>
      </div>

      {projects.length === 0 && (
        <p className="px-4 py-4 text-sm text-muted">No projects yet — add one in Projects.</p>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-1 p-2">
        {projects.map((project) => {
          const list = byProject(project.id);
          return (
            <motion.div key={project.id} variants={fadeUp} className="mb-1">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate font-mono text-xs font-semibold text-muted">{project.name}</span>
                <button
                  onClick={() => onNewSession(project.id)}
                  disabled={creatingProjectId === project.id}
                  className="btn btn-ghost !px-2 !py-1 text-base leading-none"
                  title={`New session in ${project.name}`}
                >
                  +
                </button>
              </div>

              {list.length === 0 ? (
                <p className="px-2 pb-1 text-xs text-faint">No sessions yet</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {list.map((s) => (
                    <SessionRow key={s.id} session={s} active={s.id === props.activeSessionId} {...props} />
                  ))}
                </ul>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </aside>
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
  const label = session.title ?? `Session #${session.id}`;
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
        {runtime === "working" && <span className="eyebrow !text-accent">working</span>}
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
          ✎
        </button>
        <button
          className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-danger"
          title="Delete"
          onClick={() => void requestDelete()}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

function RuntimeDot({ runtime }: { runtime: SessionRuntime }) {
  if (runtime === null) return <span className="h-2 w-2 shrink-0 rounded-full bg-faint" />;
  if (runtime === "idle") return <span className="h-2 w-2 shrink-0 rounded-full bg-success" />;
  return (
    <span className="relative grid h-2 w-2 shrink-0 place-items-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-accent"
        animate={{ opacity: [0.4, 0, 0.4], scale: [1, 2.2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="h-2 w-2 rounded-full bg-accent" />
    </span>
  );
}
