import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteConfigDocument,
  getAgentConfig,
  getConfigDocument,
  saveConfigDocument,
  type ConfigType,
  type ConfigWriteInput,
} from "../../api/agentConfig";

/**
 * Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1).
 * Query keys are defined locally to this slice (shared queryClient.ts is untouched).
 */
const AGENT_CONFIG_KEYS = {
  list: ["agent-config"] as const,
  document: (type: ConfigType, name: string) => ["agent-config", type, name] as const,
};

export function useAgentConfigList() {
  return useQuery({ queryKey: AGENT_CONFIG_KEYS.list, queryFn: getAgentConfig });
}

export function useConfigDocument(type: ConfigType | null, name: string | null) {
  return useQuery({
    queryKey: AGENT_CONFIG_KEYS.document(type ?? "agent", name ?? ""),
    queryFn: () => getConfigDocument(type as ConfigType, name as string),
    enabled: Boolean(type) && Boolean(name),
  });
}

export function useSaveConfigDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { type: ConfigType; name: string; input: ConfigWriteInput }) =>
      saveConfigDocument(vars.type, vars.name, vars.input),
    onSuccess: (_doc, vars) => {
      void qc.invalidateQueries({ queryKey: AGENT_CONFIG_KEYS.list });
      void qc.invalidateQueries({ queryKey: AGENT_CONFIG_KEYS.document(vars.type, vars.name) });
    },
  });
}

export function useDeleteConfigDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { type: ConfigType; name: string }) =>
      deleteConfigDocument(vars.type, vars.name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AGENT_CONFIG_KEYS.list });
    },
  });
}
