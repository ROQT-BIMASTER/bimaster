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

/** Extrai tokens significativos (>=4 chars alfanum) de um nome. */
function extractTokens(s: string | null | undefined): string[] {
  if (!s) return [];
  const stop = new Set([
    "LTDA", "LTDA.", "S/A", "SA", "S.A", "S.A.", "ME", "EPP", "EIRELI",
    "COMERCIO", "COMERCIAL", "INDUSTRIA", "INDUSTRIAL", "SERVICOS", "SERVIÇOS",
    "DO", "DA", "DE", "DAS", "DOS", "E", "BRASIL",
  ]);
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !stop.has(t));
}

export function useFornecedorContrato(
  codigo: string | null | undefined,
  nome?: string | null,
  empresaNome?: string | null,
) {
  const key = resolveFornecedorKey(codigo, nome);
  const supplierTokens = extractTokens(nome).slice(0, 1); // primeiro token do fornecedor
  const empresaTokens = extractTokens(empresaNome).slice(0, 2);

  return useQuery({
    queryKey: ["fornecedor-contratos", key, supplierTokens.join("|"), empresaTokens.join("|")],
    enabled: !!key,
    staleTime: 30_000,
    queryFn: async (): Promise<FornecedorContrato[]> => {
      // Monta OR: code exato, code prefix (composta), ou nome contendo token do fornecedor
      const orParts: string[] = [];
      if (key) {
        const safe = key.replace(/[,()]/g, " ");
        orParts.push(`fornecedor_codigo.eq.${safe}`);
      }
      for (const tok of supplierTokens) {
        orParts.push(`fornecedor_codigo.ilike.${tok}%`);
        orParts.push(`fornecedor_nome.ilike.%${tok}%`);
      }
      let query = supabase
        .from("fornecedor_contratos" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (orParts.length) query = query.or(orParts.join(","));

      const { data, error } = await query;
      if (error) throw error;
      let rows = ((data as any) || []) as FornecedorContrato[];

      // Filtro client-side por empresa (filial) quando informado
      if (empresaTokens.length) {
        const filtered = rows.filter((r) => {
          const blob = `${r.fornecedor_nome || ""}`.toUpperCase();
          return empresaTokens.some((t) => blob.includes(t));
        });
        if (filtered.length) rows = filtered;
      }
      return rows;
    },
  });
}
