import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ApiError } from "../../api";
import { useCreateProject } from "../../hooks/queries/useProjects";
import { toast } from "../../lib/toast";
import { Icon } from "../ui/Icon";

/**
 * Name-a-project dialog. Creating the project makes the folder + opening session
 * on the backend, then hands the new session up via onCreated — the parent
 * switches to the Sessions page and opens it, where the skill-driven wizard
 * (questions, file progress) runs in the real session view.
 */
export function CreateProjectWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (sessionId: number, projectName: string) => void;
}) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");

  const close = () => {
    setName("");
    createProject.reset();
    onClose();
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || createProject.isPending) return;
    createProject.mutate(trimmed, {
      onSuccess: (result) => {
        const projectName = result.project.name;
        close();
        onCreated(result.sessionId, projectName);
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not create the project"),
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="surface flex w-full max-w-lg flex-col p-6"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="m-0 font-mono text-base font-semibold tracking-tight">Create new project</h3>
              <button className="btn btn-ghost !px-2 !py-1.5" onClick={close} title="Close">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <p className="m-0 text-sm text-muted">
                Name the project. DevEasy creates a git-initialized folder and opens a guided session that
                scaffolds the team TypeScript stack.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="my-new-project"
                className="field"
              />
              <div className="flex justify-end gap-2">
                <button className="btn btn-ghost" onClick={close}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!name.trim() || createProject.isPending}
                  onClick={submit}
                >
                  {createProject.isPending ? "Creating…" : "Create & open"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
