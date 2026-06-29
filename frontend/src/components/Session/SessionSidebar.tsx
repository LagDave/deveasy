import { motion } from "framer-motion";
import type { Session } from "../../api/sessions";
import type { Project } from "../../types";
import { fadeUp, staggerContainer } from "../ui/motion";

/**
 * Left rail of the Sessions panel: every project is a group, its sessions listed
 * beneath. A running session shows a pulsing dot. Starting a new session is just
 * picking a project's "+", so you never have to switch the global active project.
 */
interface Props {
  projects: Project[];
  sessions: Session[];
  activeSessionId: number | null;
  creatingProjectId: number | null;
  onSelect: (sessionId: number) => void;
  onNewSession: (projectId: number) => void;
}

export function SessionSidebar({
  projects,
  sessions,
  activeSessionId,
  creatingProjectId,
  onSelect,
  onNewSession,
}: Props) {
  const byProject = (projectId: number) =>
    sessions.filter((s) => s.project_id === projectId);

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
                  {list.map((s) => {
                    const isActive = s.id === activeSessionId;
                    const runtime = s.runtime ?? null;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => onSelect(s.id)}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                            isActive ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"
                          }`}
                        >
                          <RuntimeDot runtime={runtime} />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {s.title ?? `Session #${s.id}`}
                          </span>
                          {runtime === "working" && <span className="eyebrow !text-accent">working</span>}
                          {runtime === "idle" && <span className="eyebrow !text-success">ready</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </aside>
  );
}

function RuntimeDot({ runtime }: { runtime: "working" | "idle" | null }) {
  // offline: faint static; idle/ready: steady green; working: pulsing amber.
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
