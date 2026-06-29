import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveProject, getProjects, selectProject } from "../../api/projects";
import { QUERY_KEYS } from "../../lib/queryClient";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

export function useProjects() {
  return useQuery({ queryKey: QUERY_KEYS.projects, queryFn: getProjects });
}

export function useActiveProject() {
  return useQuery({ queryKey: QUERY_KEYS.activeProject, queryFn: getActiveProject });
}

export function useSelectProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => selectProject(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.activeProject });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    },
  });
}
