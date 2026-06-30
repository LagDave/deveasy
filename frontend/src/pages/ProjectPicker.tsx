import { motion } from "framer-motion";
import { ApiError } from "../api";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Spinner } from "../components/ui/Spinner";
import { fadeUp, staggerContainer } from "../components/ui/motion";
import { useProjects } from "../hooks/queries/useProjects";

/**
 * Lists the project clones DevEasy found in projects/. Projects aren't "opened"
 * here — they appear automatically in the Sessions rail, where you start a session
 * against any of them. This view is the inventory of what DevEasy can see.
 */
export function ProjectPicker() {
  const { data: projects, isLoading, error } = useProjects();

  return (
    <div className="h-full overflow-y-auto px-8 py-7">
      {isLoading && <Spinner label="Scanning projects" />}

      {error && (
        <p className="text-sm text-danger">
          {error instanceof ApiError ? error.message : "Failed to load projects"}
        </p>
      )}

      {!isLoading && !error && (!projects || projects.length === 0) && (
        <EmptyState
          icon={<Icon name="projects" size={26} />}
          title="No projects yet"
          hint={
            <>
              Drop a git clone into the <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">projects/</code> folder
              — it appears here and in the Sessions rail automatically.
            </>
          }
        />
      )}

      {projects && projects.length > 0 && (
        <>
          <p className="mb-4 max-w-3xl text-sm text-muted">
            Start a session against any of these from the <span className="text-ink">Sessions</span> tab.
          </p>
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="m-0 flex max-w-3xl list-none flex-col gap-2.5 p-0"
          >
            {projects.map((p) => (
              <motion.li
                key={p.id}
                variants={fadeUp}
                className="surface flex items-center gap-3 px-5 py-4"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-accent">
                  <Icon name="projects" size={18} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate font-mono text-xs text-faint">{p.path}</div>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}
    </div>
  );
}
