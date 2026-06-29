import { useEffect, useState } from "react";
import type { ConfigDocument, ConfigType, Frontmatter } from "../../api/agentConfig";

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

  const confirmDelete = () => {
    const label = type === "skill" ? "skill" : "subagent";
    if (window.confirm(`Delete this ${label} (${name})? This commits the removal.`)) {
      onDelete();
    }
  };

  if (isLoading) return <p className="muted">Loading…</p>;

  return (
    <div className="config-editor">
      <p className="config-sync-note">
        Edits sync live into every open project — DevEasy symlinks this config in, so a save is
        visible to active sessions immediately and is committed to the DevEasy repo.
      </p>

      {hasFrontmatter ? (
        <div className="config-fields">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={fmName}
              onChange={(e) => setFmName(e.target.value)}
              placeholder="kebab-case-name"
            />
          </label>
          <label>
            <span>Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this is for"
            />
          </label>
        </div>
      ) : null}

      <label className="config-body-field">
        <span>Markdown body</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} spellCheck={false} />
      </label>

      <div className="config-editor-actions">
        <button type="button" onClick={submit} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save & commit"}
        </button>
        {canDelete ? (
          <button type="button" className="danger" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
