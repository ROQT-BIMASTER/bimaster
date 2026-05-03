import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type InboxCaixa = "acao_minha" | "atribuida_a_mim" | "acompanho" | "delegada_por_mim";
export type InboxOrigem =
  | "projetos"
  | "processos"
  | "motor_artes"
  | "china"
  | "aprovacoes"
  | "composicao"
  | "embalagens"
  | "amostras";
export type InboxModoLeitura = "auto" | "acao";

export interface InboxItem {
  id: string;
  user_id: string;
  caixa: InboxCaixa;
  origem: InboxOrigem;
  tipo: string;
  modo_leitura: InboxModoLeitura;
  titulo: string;
  resumo: string | null;
  action_url: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  projeto_id: string | null;
  processo_id: string | null;
  etapa_id: string | null;
  modulo: string | null;
  emitido_por: string | null;
  lido_em: string | null;
  arquivado_em: string | null;
  favorito: boolean;
  snooze_ate: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface InboxFiltros {
  caixa?: InboxCaixa;
  origem?: InboxOrigem | "todas";
  somenteNaoLidas?: boolean;
  busca?: string;
}

/**
 * Hook central para a Inbox global.
 * Lê os itens não-resolvidos do usuário atual e expõe ações em lote.
 */
export function useInbox(filtros: InboxFiltros = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inbox_items")
        .select("*")
        .eq("user_id", user!.id)
        .is("resolvido_em", null)
        .is("arquivado_em", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as InboxItem[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox_items_realtime:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_items", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["inbox-items", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const items = query.data ?? [];

  // Filtros locais
  const visiveis = items.filter((i) => {
    if (i.snooze_ate && new Date(i.snooze_ate) > new Date()) return false;
    if (filtros.caixa && i.caixa !== filtros.caixa) return false;
    if (filtros.origem && filtros.origem !== "todas" && i.origem !== filtros.origem) return false;
    if (filtros.somenteNaoLidas && i.lido_em) return false;
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase();
      if (!i.titulo.toLowerCase().includes(q) && !(i.resumo ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const counts = {
    acao_minha: items.filter((i) => i.caixa === "acao_minha").length,
    atribuida_a_mim: items.filter((i) => i.caixa === "atribuida_a_mim").length,
    acompanho: items.filter((i) => i.caixa === "acompanho").length,
    delegada_por_mim: items.filter((i) => i.caixa === "delegada_por_mim").length,
    nao_lidas_acao: items.filter((i) => i.caixa === "acao_minha" && !i.lido_em).length,
  };

  const marcarLido = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc("inbox_marcar_lido_lote", { p_ids: ids });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-items"] }),
  });

  const arquivar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc("inbox_arquivar_lote", { p_ids: ids });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Itens arquivados");
      qc.invalidateQueries({ queryKey: ["inbox-items"] });
    },
  });

  const snooze = useMutation({
    mutationFn: async (params: { ids: string[]; ate: Date }) => {
      const { error } = await supabase.rpc("inbox_snooze_lote", {
        p_ids: params.ids,
        p_ate: params.ate.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Itens adiados");
      qc.invalidateQueries({ queryKey: ["inbox-items"] });
    },
  });

  const toggleFavorito = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("inbox_toggle_favorito", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-items"] }),
  });

  return {
    items: visiveis,
    todos: items,
    counts,
    isLoading: query.isLoading,
    marcarLido: marcarLido.mutate,
    arquivar: arquivar.mutate,
    snooze: snooze.mutate,
    toggleFavorito: toggleFavorito.mutate,
  };
}
