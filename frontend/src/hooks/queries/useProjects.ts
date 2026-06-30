import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../../api/projects";
import { QUERY_KEYS } from "../../lib/queryClient";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

export function useProjects() {
  return useQuery({ queryKey: QUERY_KEYS.projects, queryFn: getProjects });
}
