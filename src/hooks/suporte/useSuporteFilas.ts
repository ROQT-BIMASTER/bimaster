import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SuporteFila, SuporteFilaAgente } from "./types";

/** Filas ativas que aceitam chamados (para o seletor de departamento). */
export function useSuporteFilas() {
  return useQuery({
    queryKey: ["suporte", "filas"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_filas" as any)
        .select("id, nome, slug, descricao, cor, icone, ativo, aceita_chamados, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as SuporteFila[];
    },
  });
}

/** Filas em que o usuário logado é agente/líder ativo (dirige o acesso ao desk). */
export function useMinhasFilasAgente() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["suporte", "minhas-filas", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: vinculos, error } = await supabase
        .from("suporte_fila_agentes" as any)
        .select("fila_id, user_id, papel, ativo")
        .eq("user_id", user!.id)
        .eq("ativo", true);
      if (error) throw error;
      const vs = ((vinculos ?? []) as unknown) as SuporteFilaAgente[];
      if (vs.length === 0) return { filas: [] as SuporteFila[], vinculos: vs };

      const { data: filas, error: fErr } = await supabase
        .from("suporte_filas" as any)
        .select("id, nome, slug, descricao, cor, icone, ativo, aceita_chamados, ordem")
        .in("id", vs.map((v) => v.fila_id))
        .order("ordem", { ascending: true });
      if (fErr) throw fErr;
      return { filas: ((filas ?? []) as unknown) as SuporteFila[], vinculos: vs };
    },
  });
}
