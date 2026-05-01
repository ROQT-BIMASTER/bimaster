// useJitRequest — solicita acesso temporário privilegiado (JIT) para escopos sensíveis.
// Uso: const { request, isLoading } = useJitRequest();
//      const id = await request({ scope: 'finance.export_full', justification: '...', minutes: 30 });
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type JitScope =
  | "finance.export_full"
  | "users.role_change_admin"
  | "users.role_change_gerente"
  | "municipios.bulk_reassign"
  | "mfa.reset_other"
  | "dre.recalculate"
  | "pentest.execute"
  | "forensic.snapshot";

export function useJitRequest() {
  const [isLoading, setLoading] = useState(false);

  const request = useCallback(async (opts: { scope: JitScope; justification: string; minutes?: number }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("jit_request", {
        _scope: opts.scope,
        _justification: opts.justification,
        _minutes: opts.minutes ?? 30,
      });
      if (error) throw error;
      toast.success("Solicitação enviada — aguardando aprovação de admin.");
      return data as string;
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao solicitar acesso");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkActive = useCallback(async (userId: string, scope: JitScope) => {
    const { data, error } = await supabase.rpc("jit_active", { _user_id: userId, _scope: scope });
    if (error) return false;
    return !!data;
  }, []);

  return { request, checkActive, isLoading };
}
