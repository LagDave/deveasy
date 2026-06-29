import { useState } from "react";
import { ApiError } from "../../api";
import type { ConfigType, Frontmatter } from "../../api/agentConfig";
import {
  useAgentConfigList,
  useConfigDocument,
  useDeleteConfigDocument,
  useSaveConfigDocument,
} from "../../hooks/queries/useAgentConfig";
import { toast } from "../../lib/toast";
import { AgentConfigEditor } from "./AgentConfigEditor";
import { AgentConfigList } from "./AgentConfigList";

const CLAUDE_MD_NAME = "CLAUDE.md";

type Selection =
  | { type: ConfigType; name: string; isNew: false }
  | { type: "agent" | "skill"; name: string; isNew: true };

/**
 * Self-contained, mountable panel for the Agent & Skill Manager. Owns the
 * selection state; delegates fetching to React Query hooks and rendering to the
 * list + editor children (Constitution §13.2, §14.3, §15.1).
 */
export function AgentManagerPanel() {
  const list = useAgentConfigList();
  const [selection, setSelection] = useState<Selection | null>(null);

  const save = useSaveConfigDocument();
  const remove = useDeleteConfigDocument();

  // Only fetch the document for an existing selection; new items start blank.
  const docQuery = useConfigDocument(
    selection && !selection.isNew ? selection.type : null,
    selection && !selection.isNew ? selection.name : null,
  );

  const onSelect = (type: ConfigType, name: string) => {
    setSelection({ type, name, isNew: false });
  };

  const onCreate = (type: "agent" | "skill") => {
    const name = window.prompt(`New ${type} name (kebab-case, no slashes):`)?.trim();
    if (!name) return;
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      toast.error("Name cannot contain slashes or '..'.");
      return;
    }
    setSelection({ type, name, isNew: true });
  };

  const onSave = (input: { frontmatter: Frontmatter; body: string }) => {
    if (!selection) return;
    save.mutate(
      { type: selection.type, name: selection.name, input },
      {
        onSuccess: () => {
          toast.success(`Saved ${selection.name}`);
          setSelection({ type: selection.type, name: selection.name, isNew: false });
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Could not save the config"),
      },
    );
  };

  const onDelete = () => {
    if (!selection || selection.isNew) return;
    remove.mutate(
      { type: selection.type, name: selection.name },
      {
        onSuccess: () => {
          toast.success(`Deleted ${selection.name}`);
          setSelection(null);
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Could not delete the config"),
      },
    );
  };

  if (list.isLoading) return <p className="muted">Loading config…</p>;
  if (list.error) {
    return (
      <p className="error">
        {list.error instanceof ApiError ? list.error.message : "Failed to load config"}
      </p>
    );
  }
  if (!list.data) return null;

  return (
    <div className="agent-manager">
      <AgentConfigList
        listing={list.data}
        selected={selection ? { type: selection.type, name: selection.name } : null}
        onSelect={onSelect}
        onCreate={onCreate}
      />

      <div className="agent-manager-editor">
        {selection ? (
          <AgentConfigEditor
            key={`${selection.type}-${selection.name}-${selection.isNew}`}
            type={selection.type}
            name={selection.name}
            document={selection.isNew ? null : docQuery.data ?? null}
            isLoading={!selection.isNew && docQuery.isLoading}
            isSaving={save.isPending}
            isDeleting={remove.isPending}
            canDelete={!selection.isNew && selection.name !== CLAUDE_MD_NAME}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : (
          <p className="muted">Select an agent, skill, or CLAUDE.md to edit — or create a new one.</p>
        )}
      </div>
    </div>
  );
}
