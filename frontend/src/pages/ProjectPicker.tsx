import { motion } from "framer-motion";
import { ApiError } from "../api";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Spinner } from "../components/ui/Spinner";
import { fadeUp, staggerContainer } from "../components/ui/motion";
import { useActiveProject, useProjects, useSelectProject } from "../hooks/queries/useProjects";
import { toast } from "../lib/toast";

/**
 * Lists the project clones in projects/ and selects one as the active project,
 * which triggers shared-config injection on the backend.
 */
export function ProjectPicker() {
  const { data: projects, isLoading, error } = useProjects();
  const { data: active } = useActiveProject();
  const select = useSelectProject();

  const onSelect = (id: number) => {
    select.mutate(id, {
      onSuccess: (p) => toast.success(`Opened ${p.name}`),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not open the project"),
    });
  };

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
              Drop a git clone into the <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">projects/</code> folder,
              then it appears here automatically.
            </>
          }
        />
      )}

      {projects && projects.length > 0 && (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="m-0 flex max-w-3xl list-none flex-col gap-2.5 p-0"
        >
          {projects.map((p) => {
            const isActive = active?.id === p.id;
            return (
              <motion.li
                key={p.id}
                variants={fadeUp}
                className={`surface card-hover flex items-center justify-between gap-4 px-5 py-4 ${
                  isActive ? "!border-accent-line" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-sm text-accent">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate font-mono text-xs text-faint">{p.path}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {isActive && <span className="pill pill-success">Active</span>}
                  <button
                    className={isActive ? "btn btn-ghost" : "btn btn-primary"}
                    disabled={select.isPending}
                    onClick={() => onSelect(p.id)}
                  >
                    {isActive ? "Reopen" : "Open"}
                  </button>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
