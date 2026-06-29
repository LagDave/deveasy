import { useActiveProject, useProjects, useSelectProject } from "../hooks/queries/useProjects";
import { ApiError } from "../api";
import { toast } from "../lib/toast";

/**
 * Lists the project clones in projects/ and lets the operator select one as the
 * active project, which triggers shared-config injection on the backend.
 */
export function ProjectPicker() {
  const { data: projects, isLoading, error } = useProjects();
  const { data: active } = useActiveProject();
  const select = useSelectProject();

  const onSelect = (id: number) => {
    select.mutate(id, {
      onSuccess: (p) => toast.success(`Opened ${p.name}`),
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : "Could not open the project"),
    });
  };

  if (isLoading) return <p className="muted">Scanning projects…</p>;
  if (error) {
    return <p className="error">{error instanceof ApiError ? error.message : "Failed to load projects"}</p>;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="empty">
        <h2>No projects yet</h2>
        <p className="muted">Drop a git clone into the <code>projects/</code> folder, then refresh.</p>
      </div>
    );
  }

  return (
    <ul className="project-list">
      {projects.map((p) => {
        const isActive = active?.id === p.id;
        return (
          <li key={p.id} className={isActive ? "project active" : "project"}>
            <div>
              <strong>{p.name}</strong>
              <span className="muted path">{p.path}</span>
            </div>
            <button disabled={select.isPending} onClick={() => onSelect(p.id)}>
              {isActive ? "Active" : "Open"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
