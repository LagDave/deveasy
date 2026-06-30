import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ApiError } from "../../api";
import { useCreateProject } from "../../hooks/queries/useProjects";
import { toast } from "../../lib/toast";
import { Icon } from "../ui/Icon";
import { WizardChat } from "./WizardChat";

/**
 * Two-step create-project modal. Step 1 names the project and calls the create
 * endpoint (useCreateProject); step 2 hands the returned session to WizardChat,
 * which drives the skill conversation. Controlled by the parent via open/onClose
 * (§13.2: state is light, the mutation/session logic lives in hooks).
 */
export function CreateProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ sessionId: number; projectName: string } | null>(null);

  const close = () => {
    setName("");
    setCreated(null);
    createProject.reset();
    onClose();
  };

  const submitName = () => {
    const trimmed = name.trim();
    if (!trimmed || createProject.isPending) return;
    createProject.mutate(trimmed, {
      onSuccess: (result) => setCreated({ sessionId: result.sessionId, projectName: result.project.name }),
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
            className="surface flex max-h-[85vh] w-full max-w-2xl flex-col p-6"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="m-0 font-mono text-base font-semibold tracking-tight">
                {created ? `Scaffolding ${created.projectName}` : "Create new project"}
              </h3>
              <button className="btn btn-ghost !px-2 !py-1.5" onClick={close} title="Close">
                <Icon name="close" size={16} />
              </button>
            </div>

            {created ? (
              <WizardChat
                sessionId={created.sessionId}
                projectName={created.projectName}
                onDone={() => toast.success("Project scaffolded")}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-sm text-muted">
                  Name the project. DevEasy creates a git-initialized folder and a guided session that
                  scaffolds the team TypeScript stack.
                </p>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitName();
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
                    onClick={submitName}
                  >
                    {createProject.isPending ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
