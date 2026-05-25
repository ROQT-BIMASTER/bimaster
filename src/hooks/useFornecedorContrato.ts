import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FornecedorContrato {
  id: string;
  fornecedor_codigo: string;
  fornecedor_nome: string | null;
  tipo: "ativo" | "cancelamento";
  data_vigencia_inicio: string | null;
  data_vigencia_fim: string | null;
  numero_contrato: string | null;
  valor_mensal: number | null;
  valor_total: number | null;
  observacoes: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_mime: string | null;
  arquivo_tamanho: number | null;
  resumo_ia: string | null;
  analise_ia_json: any;
  analise_ia_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Normaliza a chave (usa código ERP se houver, senão nome). */
export function resolveFornecedorKey(
  codigo: string | null | undefined,
  nome: string | null | undefined,
): string | null {
  const c = (codigo || "").trim();
  if (c) return c;
  const n = (nome || "").trim();
  return n || null;
}

export function useFornecedorContrato(
  codigo: string | null | undefined,
  nome?: string | null,
) {
  const key = resolveFornecedorKey(codigo, nome);
  return useQuery({
    queryKey: ["fornecedor-contratos", key],
    enabled: !!key,
    staleTime: 30_000,
    queryFn: async (): Promise<FornecedorContrato[]> => {
      const { data, error } = await supabase
        .from("fornecedor_contratos" as any)
        .select("*")
        .eq("fornecedor_codigo", key as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });
}
