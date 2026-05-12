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

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-copilot-relatorios`;

export function useCopilotRelatorios(submissaoId: string | null | undefined) {
  return useQuery<CopilotRelatorioItem[]>({
    queryKey: ["china-copilot-rel", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const r = await fetch(`${BASE}?submissao_id=${submissaoId}`, { headers: await authHeaders() });
      if (!r.ok) return [];
      const j = await r.json();
      return j.itens ?? [];
    },
  });
}

export async function fetchRelatorioFull(id: string): Promise<CopilotRelatorioFull | null> {
  const r = await fetch(`${BASE}?id=${id}`, { headers: await authHeaders() });
  if (!r.ok) return null;
  const j = await r.json();
  return j.relatorio ?? null;
}

export async function fetchRelatorioPdfUrl(id: string): Promise<string | null> {
  const r = await fetch(`${BASE}?id=${id}&download=pdf`, { headers: await authHeaders() });
  if (!r.ok) return null;
  const j = await r.json();
  return j.url ?? null;
}

export function useArchivePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pdf_base64 }: { id: string; pdf_base64: string }) => {
      const headers = await authHeaders();
      const r = await fetch(BASE, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id, pdf_base64 }),
      });
      if (!r.ok) throw new Error(`upload failed (${r.status})`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-copilot-rel"] });
    },
  });
}
