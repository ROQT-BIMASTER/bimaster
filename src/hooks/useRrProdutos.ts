import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";

export interface RrProduto {
  notion_page_id: string;
  sku: string | null;
  nome_comercial: string | null;
  marca: string | null;
  categoria: string | null;
  status: string | null;
  composicao_pt: boolean | null;
  composicao_en: boolean | null;
  anvisa: string | null;
  linha_notion_id: string | null;
  ultima_revisao_regulatoria: string | null;
  wf: Record<string, string | null> | null;
  raw: unknown;
  synced_at: string | null;
}

export interface RrLinha {
  notion_page_id: string;
  nome: string | null;
  marca: string | null;
}

export function useRrProdutos() {
  return useSupabaseQuery<RrProduto[]>(
    ["rr_produtos"],
    async () => {
      const { data, error } = await supabase
        .from("rr_produtos")
        .select("*")
        .order("nome_comercial", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RrProduto[];
    },
  );
}

export function useRrLinhas() {
  return useSupabaseQuery<RrLinha[]>(
    ["rr_linhas"],
    async () => {
      const { data, error } = await supabase
        .from("rr_linhas")
        .select("notion_page_id, nome, marca");
      if (error) throw error;
      return (data ?? []) as unknown as RrLinha[];
    },
  );
}
