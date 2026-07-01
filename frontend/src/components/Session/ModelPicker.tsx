import { useState } from "react";
import type { ClaudeModel, ModelCatalog } from "../../types/models";
import { activeModel, latestPerFamily, prettyModel, shortName } from "../../utils/modelLabels";
import { Icon } from "../ui/Icon";

/**
 * Model picker driven by the live catalog (/api/usage/models). Shows the latest of
 * each family with versions, plus a "More models" expander for older versions. The
 * pill reflects the current selection/resolved model with its version.
 */
interface Props {
  catalog: ModelCatalog | undefined;
  selectedModel: string | null;
  resolvedModel: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}

export function ModelPicker({ catalog, selectedModel, resolvedModel, disabled, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const models = catalog?.models ?? [];
  const { top, more } = latestPerFamily(models);
  const active = activeModel(models, selectedModel, resolvedModel);
  const pill = active
    ? shortName(active.displayName)
    : (prettyModel(resolvedModel) ?? prettyModel(selectedModel) ?? "Model");

  const close = () => {
    setOpen(false);
    setShowMore(false);
  };
  const choose = (id: string) => {
    onSelect(id);
    close();
  };

  const row = (m: ClaudeModel) => (
    <button
      key={m.id}
      type="button"
      onClick={() => choose(m.id)}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2 ${
        m.id === selectedModel ? "bg-surface-2" : ""
      }`}
    >
      <span>{shortName(m.displayName)}</span>
      {m.id === selectedModel && <Icon name="done" size={13} className="text-success" />}
    </button>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="btn btn-ghost !px-2.5 !py-1.5 disabled:opacity-50"
        title={disabled ? "Switch model when idle" : "Switch model (keeps context)"}
      >
        <Icon name="instant" size={14} />
        <span className="font-mono text-xs">{pill}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="surface absolute bottom-full right-0 z-20 mb-2 max-h-80 w-56 overflow-y-auto p-1">
            <p className="eyebrow px-2.5 py-1">Models</p>
            {top.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-faint">{catalog ? "No models available" : "Loading…"}</p>
            )}
            {top.map(row)}
            {more.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMore((s) => !s)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted hover:bg-surface-2"
                >
                  <span>More models</span>
                  <Icon name={showMore ? "chevronDown" : "chevronRight"} size={13} />
                </button>
                {showMore && more.map(row)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
