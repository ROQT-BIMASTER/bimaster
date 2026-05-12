import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CopilotRelatorioItem {
  id: string;
  submissao_id: string;
  idioma: "pt" | "en" | "zh";
  profundidade: "executivo" | "completo";
  model: string | null;
  pdf_path: string | null;
  gerado_por: string | null;
  gerado_por_nome?: string | null;
  created_at: string;
  kpis?: any;
  submissao_snapshot?: any;
}

export interface CopilotRelatorioFull extends CopilotRelatorioItem {
  markdown: string;
  analytics: any;
}

export function useCopilotRelatorios(submissaoId: string | null | undefined) {
  return useQuery<CopilotRelatorioItem[]>({
    queryKey: ["china-copilot-rel", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("china-copilot-relatorios", {
        body: undefined,
        method: "GET",
        // @ts-expect-error supabase-js v2 supports query through 'headers' workaround; using direct fetch is simpler
      });
      // Fallback usando fetch direto (mais previsível para query string)
      if (error) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-copilot-relatorios?submissao_id=${submissaoId}`;
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
        const j = await r.json();
        return j.itens ?? [];
      }
      return (data as any)?.itens ?? [];
    },
  });
}

export async function fetchRelatorioFull(id: string): Promise<CopilotRelatorioFull | null> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-copilot-relatorios?id=${id}`;
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.relatorio ?? null;
}

export async function fetchRelatorioPdfUrl(id: string): Promise<string | null> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-copilot-relatorios?id=${id}&download=pdf`;
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.url ?? null;
}

export function useArchivePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pdf_base64 }: { id: string; pdf_base64: string }) => {
      const { data, error } = await supabase.functions.invoke("china-copilot-relatorios", {
        body: { id, pdf_base64 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-copilot-rel"] });
    },
  });
}
