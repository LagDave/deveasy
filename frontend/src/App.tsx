import { useState } from "react";
import { useActiveProject } from "./hooks/queries/useProjects";
import { ProjectPicker } from "./pages/ProjectPicker";
import { SessionPanel } from "./components/Session/SessionPanel";
import { CockpitPanel } from "./components/Cockpit/CockpitPanel";
import { AgentManagerPanel } from "./components/AgentManager/AgentManagerPanel";

type SectionId = "projects" | "sessions" | "cockpit" | "agents";

interface Section {
  id: SectionId;
  label: string;
  render: () => React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: "projects", label: "Projects", render: () => <ProjectPicker /> },
  { id: "sessions", label: "Sessions", render: () => <SessionPanel /> },
  { id: "cockpit", label: "Cockpit", render: () => <CockpitPanel /> },
  { id: "agents", label: "Agents", render: () => <AgentManagerPanel /> },
];

/**
 * App shell. The sidebar switches between workspace sections; the main panel
 * renders the active section. All sections operate on the active project.
 */
export default function App() {
  const { data: active } = useActiveProject();
  const [section, setSection] = useState<SectionId>("projects");
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">DevEasy</h1>
        <nav>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === section ? "nav-item active" : "nav-item"}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="active-project">
          <span className="eyebrow">Active project</span>
          <strong>{active ? active.name : "None selected"}</strong>
        </div>
      </aside>

      <main className="panel">
        <header className="panel-header">
          <h2>{current.label}</h2>
        </header>
        <section className="panel-body">{current.render()}</section>
      </main>
    </div>
  );
}
