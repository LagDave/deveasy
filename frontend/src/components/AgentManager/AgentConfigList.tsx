import { motion } from "framer-motion";
import type { ConfigListing, ConfigSummary, ConfigType } from "../../api/agentConfig";
import { fadeUp, staggerContainer } from "../ui/motion";

interface Props {
  listing: ConfigListing;
  selected: { type: ConfigType; name: string } | null;
  onSelect: (type: ConfigType, name: string) => void;
  onCreate: (type: "agent" | "skill") => void;
}

/**
 * Renders the config inventory grouped by Agents / Skills / CLAUDE.md. Pure
 * presentation — it renders and reports clicks; the panel owns the state (§13.3).
 */
export function AgentConfigList({ listing, selected, onSelect, onCreate }: Props) {
  const isSelected = (type: ConfigType, name: string) =>
    selected?.type === type && selected?.name === name;

  const renderItem = (item: ConfigSummary) => {
    const active = isSelected(item.type, item.name);
    return (
      <motion.li key={`${item.type}-${item.name}`} variants={fadeUp}>
        <button
          type="button"
          onClick={() => onSelect(item.type, item.name)}
          className={`surface-2 card-hover flex w-full flex-col items-start gap-1 px-3.5 py-3 text-left ${
            active ? "!border-accent-line bg-surface-2" : ""
          }`}
        >
          <span className="truncate font-mono text-sm text-ink">{item.title ?? item.name}</span>
          {item.description ? (
            <span className="line-clamp-2 text-xs text-muted">{item.description}</span>
          ) : null}
        </button>
      </motion.li>
    );
  };

  return (
    <div className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-5 py-5">
      <Group label="Agents" onCreate={() => onCreate("agent")}>
        {listing.agents.length === 0 ? (
          <p className="text-sm text-muted">No subagents yet.</p>
        ) : (
          <ItemList>{listing.agents.map(renderItem)}</ItemList>
        )}
      </Group>

      <Group label="Skills" onCreate={() => onCreate("skill")}>
        {listing.skills.length === 0 ? (
          <p className="text-sm text-muted">No skills yet.</p>
        ) : (
          <ItemList>{listing.skills.map(renderItem)}</ItemList>
        )}
      </Group>

      <Group label="CLAUDE.md">
        {listing.claudemd ? (
          <ItemList>{renderItem(listing.claudemd)}</ItemList>
        ) : (
          <p className="text-sm text-muted">No root CLAUDE.md found.</p>
        )}
      </Group>
    </div>
  );
}

function Group({
  label,
  onCreate,
  children,
}: {
  label: string;
  onCreate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <header className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {onCreate ? (
          <button type="button" className="btn btn-ghost px-2 py-1" onClick={onCreate}>
            + New
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function ItemList({ children }: { children: React.ReactNode }) {
  return (
    <motion.ul
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="m-0 flex list-none flex-col gap-2 p-0"
    >
      {children}
    </motion.ul>
  );
}
