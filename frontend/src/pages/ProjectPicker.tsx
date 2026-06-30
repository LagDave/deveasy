import { motion } from "framer-motion";
import { useState } from "react";
import { ApiError } from "../api";
import { CreateProjectWizard } from "../components/CreateProject/CreateProjectWizard";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Spinner } from "../components/ui/Spinner";
import { fadeUp, staggerContainer } from "../components/ui/motion";
import { useProjects } from "../hooks/queries/useProjects";

/**
 * Lists the project clones DevEasy found in projects/. Projects aren't "opened"
 * here — they appear automatically in the Sessions rail, where you start a session
 * against any of them. This view is the inventory of what DevEasy can see, plus the
 * entry point for scaffolding a new project via the create wizard.
 */
export function ProjectPicker({
  onProjectCreated,
}: {
  /** Hand the freshly-created session to the parent so it can open it in Sessions. */
  onProjectCreated?: (sessionId: number, projectName: string) => void;
}) {
  const { data: projects, isLoading, error } = useProjects();
  const [wizardOpen, setWizardOpen] = useState(false);

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
              Create a new project below, or drop a git clone into the{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">projects/</code> folder — either appears
              here and in the Sessions rail automatically.
            </>
          }
          action={
            <button className="btn btn-primary" onClick={() => setWizardOpen(true)}>
              <Icon name="add" size={15} />
              Create new project
            </button>
          }
        />
      )}

      {projects && projects.length > 0 && (
        <>
          <div className="mb-4 flex max-w-3xl items-center justify-between gap-3">
            <p className="m-0 text-sm text-muted">
              Start a session against any of these from the <span className="text-ink">Sessions</span> tab.
            </p>
            <button className="btn btn-primary shrink-0" onClick={() => setWizardOpen(true)}>
              <Icon name="add" size={15} />
              Create new project
            </button>
          </div>
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

      <CreateProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(sessionId, projectName) => onProjectCreated?.(sessionId, projectName)}
      />
    </div>
  );
}
