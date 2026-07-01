import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface ChinaOPRow {
  id: string;
  numero: string;
  produto_id: string | null;
  produto_codigo?: string | null;
  produto_nome?: string | null;
  formula_id: string | null;
  quantidade_planejada: number;
  quantidade_produzida: number | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  data_prevista: string | null;
  lote: string | null;
  observacoes: string | null;
  created_at: string;
  created_by: string | null;
  // join
  oc_id?: string | null;
  oc_numero?: string | null;
  submissao_id?: string | null;
  submissao_numero?: string | null;
}

/**
 * Lista OPs criadas no contexto China (numero começa com OP-CN-)
 * com vínculo opcional a OC e submissão.
 */
export function useChinaOrdensProducao() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["china-ordens-producao"],
    queryFn: async () => {
      const { data: ops, error } = await supabase
        .from("fabrica_ordens_producao" as any)
        .select(
          "id, numero, produto_id, formula_id, quantidade_planejada, quantidade_produzida, status, data_inicio, data_fim, data_prevista, lote, observacoes, created_at, created_by"
        )
        .like("numero", "OP-CN-%")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const opIds = (ops as any[]).map((o) => o.id);
      const produtoIds = Array.from(
        new Set((ops as any[]).map((o) => o.produto_id).filter(Boolean))
      );

      const [vincRes, prodRes] = await Promise.all([
        opIds.length
          ? supabase
              .from("compras_internacional_vinculos" as any)
              .select("fabrica_op_id, china_ordem_compra_id, china_ordens_compra(id, numero_oc, submissao_id)")
              .in("fabrica_op_id", opIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        produtoIds.length
          ? supabase
              .from("fabrica_produtos" as any)
              .select("id, codigo, nome")
              .in("id", produtoIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const vincMap = new Map<string, any>();
      ((vincRes.data as any[]) || []).forEach((v) => vincMap.set(v.fabrica_op_id, v));
      const prodMap = new Map<string, any>();
      ((prodRes.data as any[]) || []).forEach((p) => prodMap.set(p.id, p));

      // Submissões para resolver número
      const subIds = Array.from(
        new Set(
          ((vincRes.data as any[]) || [])
            .map((v) => v.china_ordens_compra?.submissao_id)
            .filter(Boolean)
        )
      );
      let subMap = new Map<string, any>();
      if (subIds.length) {
        const { data: subs } = await supabase
          .from("china_produto_submissoes" as any)
          .select("id, numero_ordem, produto_codigo, produto_nome, created_by")
          .in("id", subIds);
        ((subs as any[]) || []).forEach((s) => subMap.set(s.id, s));
      }

      return (ops as any[]).map((o) => {
        const v = vincMap.get(o.id);
        const oc = v?.china_ordens_compra;
        const sub = oc?.submissao_id ? subMap.get(oc.submissao_id) : undefined;
        const prod = o.produto_id ? prodMap.get(o.produto_id) : undefined;
        return {
          ...o,
          produto_codigo: prod?.codigo || null,
          produto_nome: prod?.nome || null,
          oc_id: oc?.id || null,
          oc_numero: oc?.numero_oc || null,
          submissao_id: oc?.submissao_id || null,
          submissao_numero: sub?.numero_ordem || null,
        } as ChinaOPRow;
      });
    },
    staleTime: 30_000,
  });

  // Realtime: refrescar lista a cada change
  useEffect(() => {
    const ch = supabase
      .channel("china-ops-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fabrica_ordens_producao" },
        () => qc.invalidateQueries({ queryKey: ["china-ordens-producao"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export interface CriarOPChinaInput {
  submissao_id: string;
  qty: number;
  oc_id?: string | null;
  produto_id?: string | null;
  formula_id?: string | null;
  lote?: string | null;
  data_inicio?: string | null;
  data_prevista?: string | null;
  obs?: string | null;
}

export function useCriarOPChina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarOPChinaInput) => {
      const { data, error } = await supabase.rpc("rpc_china_criar_op" as any, {
        p_submissao_id: input.submissao_id,
        p_qty: input.qty,
        p_oc_id: input.oc_id ?? null,
        p_produto_id: input.produto_id ?? null,
        p_formula_id: input.formula_id ?? null,
        p_lote: input.lote ?? null,
        p_data_inicio: input.data_inicio ?? null,
        p_data_prevista: input.data_prevista ?? null,
        p_obs: input.obs ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
      return row as { op_id: string; numero: string };
    },
    onSuccess: (d, vars) => {
      qc.invalidateQueries({ queryKey: ["china-ordens-producao"] });
      qc.invalidateQueries({ queryKey: ["china-ordens"] });
      const semOc = !vars.oc_id;
      toast.success(
        `Ordem de Produção ${d.numero} criada${semOc ? " · comprador notificado" : ""}`
      );
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao criar OP"),
  });
}
