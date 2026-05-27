import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SecurityDefinerStatus } from "@/lib/security/securityDefinerStatus";
import { toast } from "sonner";

interface UpsertOverrideInput {
  schema_name: string;
  function_name: string;
  function_signature: string;
  status_override: SecurityDefinerStatus | null;
  nota: string | null;
}

export function useSecurityDefinerOverride() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertOverrideInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("security_definer_overrides")
        .upsert(
          {
            schema_name: input.schema_name,
            function_name: input.function_name,
            function_signature: input.function_signature,
            status_override: input.status_override,
            nota: input.nota,
            reviewed_by: userData.user?.id ?? null,
            reviewed_at: new Date().toISOString(),
          },
          { onConflict: "schema_name,function_name,function_signature" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-definer-overrides"] });
      toast.success("Revisão salva", { description: "Status e nota atualizados." });
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar revisão", { description: err.message });
    },
  });
}
