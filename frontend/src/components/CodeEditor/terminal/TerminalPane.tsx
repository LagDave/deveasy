import { type ReactNode } from "react";
import { Icon } from "../../ui/Icon";
import { TerminalInstance } from "./TerminalInstance";
import { type Pane, type SplitDir, paneKey } from "./terminalLayout";

interface Props {
  pane: Pane;
  onSplit: (terminalId: string, dir: SplitDir) => void;
  onClose: (terminalId: string) => void;
}

/** Recursively render a tab's split tree: flex rows/cols of nested panes, leaves are PTYs. */
export function TerminalPane({ pane, onSplit, onClose }: Props) {
  if (pane.type === "leaf") {
    return <LeafPane terminalId={pane.terminalId} onSplit={onSplit} onClose={onClose} />;
  }
  return (
    <div className={`flex h-full w-full gap-px ${pane.dir === "row" ? "flex-row" : "flex-col"}`}>
      {pane.children.map((child) => (
        <div key={paneKey(child)} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <TerminalPane pane={child} onSplit={onSplit} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

function LeafPane({
  terminalId,
  onSplit,
  onClose,
}: {
  terminalId: string;
  onSplit: (terminalId: string, dir: SplitDir) => void;
  onClose: (terminalId: string) => void;
}) {
  return (
    <div className="group relative h-full w-full">
      <TerminalInstance terminalId={terminalId} />
      {/* Corner controls: split right, split down, close — shown on hover. */}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-md border border-line bg-surface-2/90 p-0.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
        <PaneButton title="Split right" onClick={() => onSplit(terminalId, "row")}>
          <Icon name="splitRight" size={13} />
        </PaneButton>
        <PaneButton title="Split down" onClick={() => onSplit(terminalId, "col")}>
          <Icon name="splitDown" size={13} />
        </PaneButton>
        <PaneButton title="Close pane" onClick={() => onClose(terminalId)}>
          <Icon name="close" size={13} />
        </PaneButton>
      </div>
    </div>
  );
}

function PaneButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
    >
      {children}
    </button>
  );
}
