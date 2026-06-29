import { useActiveProject } from "./hooks/queries/useProjects";
import { ProjectPicker } from "./pages/ProjectPicker";

/**
 * App shell. The sidebar lists workspace sections; the main panel renders the
 * active section. Feature slices (Session, Cockpit, Agent Manager) add their nav
 * entry + panel at the markers during integration.
 */
export default function App() {
  const { data: active } = useActiveProject();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">DevEasy</h1>
        <nav>
          <a className="nav-item active" href="#projects">Projects</a>
          {/* <deveasy:nav> — feature slices add their nav entries here. */}
        </nav>
        <div className="active-project">
          <span className="eyebrow">Active project</span>
          <strong>{active ? active.name : "None selected"}</strong>
        </div>
      </aside>

      <main className="panel">
        <header className="panel-header">
          <h2>Projects</h2>
        </header>
        <section className="panel-body">
          <ProjectPicker />
          {/* <deveasy:panels> — feature slices add their routed panels here. */}
        </section>
      </main>
    </div>
  );
}
