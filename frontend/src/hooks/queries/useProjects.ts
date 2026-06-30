import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, getProjects, type CreateProjectResult } from "../../api/projects";
import { QUERY_KEYS } from "../../lib/queryClient";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

export function useProjects() {
  return useQuery({ queryKey: QUERY_KEYS.projects, queryFn: getProjects });
}

/** Scaffolds a new project; invalidates the list so the new project surfaces (§15.1). */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation<CreateProjectResult, Error, string>({
    mutationFn: (name) => createProject(name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEYS.projects }),
  });
}
