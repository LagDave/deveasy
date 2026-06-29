import type { ConfigListing, ConfigSummary, ConfigType } from "../../api/agentConfig";

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

  const renderItem = (item: ConfigSummary) => (
    <li key={`${item.type}-${item.name}`}>
      <button
        type="button"
        className={isSelected(item.type, item.name) ? "config-item active" : "config-item"}
        onClick={() => onSelect(item.type, item.name)}
      >
        <strong>{item.title ?? item.name}</strong>
        {item.description ? <span className="muted">{item.description}</span> : null}
      </button>
    </li>
  );

  return (
    <div className="config-list">
      <section>
        <header className="config-group-header">
          <h3>Agents</h3>
          <button type="button" onClick={() => onCreate("agent")}>
            + New
          </button>
        </header>
        {listing.agents.length === 0 ? (
          <p className="muted">No subagents yet.</p>
        ) : (
          <ul>{listing.agents.map(renderItem)}</ul>
        )}
      </section>

      <section>
        <header className="config-group-header">
          <h3>Skills</h3>
          <button type="button" onClick={() => onCreate("skill")}>
            + New
          </button>
        </header>
        {listing.skills.length === 0 ? (
          <p className="muted">No skills yet.</p>
        ) : (
          <ul>{listing.skills.map(renderItem)}</ul>
        )}
      </section>

      <section>
        <header className="config-group-header">
          <h3>CLAUDE.md</h3>
        </header>
        {listing.claudemd ? (
          <ul>{renderItem(listing.claudemd)}</ul>
        ) : (
          <p className="muted">No root CLAUDE.md found.</p>
        )}
      </section>
    </div>
  );
}
