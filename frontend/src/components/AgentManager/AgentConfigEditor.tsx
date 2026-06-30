import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ConfigDocument, ConfigType, Frontmatter } from "../../api/agentConfig";
import { useConfirm } from "../ui/confirm";
import { fadeUp } from "../ui/motion";
import { Spinner } from "../ui/Spinner";

interface Props {
  type: ConfigType;
  name: string;
  /** The loaded document, or null for a brand-new unsaved item. */
  document: ConfigDocument | null;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  canDelete: boolean;
  onSave: (input: { frontmatter: Frontmatter; body: string }) => void;
  onDelete: () => void;
}

/** Pull a string frontmatter field, defaulting to "". */
function fmString(frontmatter: Frontmatter | undefined, key: string): string {
  const value = frontmatter?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Editor surfacing the structured frontmatter fields (name, description) plus a
 * markdown body textarea. CLAUDE.md has no frontmatter, so those fields hide for
 * it. Save/delete are reported up; the panel owns the mutations (§13.2, §13.3).
 */
export function AgentConfigEditor({
  type,
  name,
  document,
  isLoading,
  isSaving,
  isDeleting,
  canDelete,
  onSave,
  onDelete,
}: Props) {
  const hasFrontmatter = type !== "claudemd";
  const confirm = useConfirm();
  const [fmName, setFmName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  // Re-seed the form whenever the loaded document (or selection) changes.
  useEffect(() => {
    setFmName(hasFrontmatter ? fmString(document?.frontmatter, "name") || name : "");
    setDescription(fmString(document?.frontmatter, "description"));
    setBody(document?.body ?? "");
  }, [document, name, hasFrontmatter]);

  const submit = () => {
    if (hasFrontmatter) {
      const frontmatter: Frontmatter = {
        ...(document?.frontmatter ?? {}),
        name: fmName.trim(),
        description: description.trim(),
      };
      onSave({ frontmatter, body });
      return;
    }
    onSave({ frontmatter: {}, body });
  };

  const confirmDelete = async () => {
    const label = type === "skill" ? "skill" : "subagent";
    const ok = await confirm({
      title: `Delete ${label}?`,
      message: `"${name}" will be removed and the deletion committed to the repo.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) onDelete();
  };

  if (isLoading) {
    return (
      <div className="px-8 py-7">
        <Spinner label="Loading config" />
      </div>
    );
  }

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6"
    >
      <header className="flex items-center gap-2">
        <span className="pill pill-accent">{type}</span>
        <span className="font-mono text-sm text-ink">{name}</span>
      </header>

      <p className="surface-2 px-4 py-3 text-xs text-muted">
        Edits sync live into every open project — DevEasy symlinks this config in, so a save is
        visible to active sessions immediately and is committed to the DevEasy repo.
      </p>

      {hasFrontmatter ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Name</span>
            <input
              type="text"
              className="field font-mono text-sm"
              value={fmName}
              onChange={(e) => setFmName(e.target.value)}
              placeholder="kebab-case-name"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Description</span>
            <input
              type="text"
              className="field text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this is for"
            />
          </label>
        </div>
      ) : null}

      <label className="flex flex-1 flex-col gap-1.5">
        <span className="eyebrow">Markdown body</span>
        <textarea
          className="field min-h-[22rem] flex-1 resize-y font-mono text-xs leading-relaxed"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
        />
      </label>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save & commit"}
        </button>
        {canDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void confirmDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
