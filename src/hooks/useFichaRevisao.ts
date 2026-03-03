import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CustoInsumo, CustoConfig, Totais } from "./useFichaCustoProduto";

export type StatusAprovacao = "rascunho" | "em_revisao" | "aprovada" | "revisao_solicitada";

export interface RevisaoItem {
  id: string;
  revisao_id: string;
  insumo_id: string | null;
  campo: string;
  valor_atual: number;
  valor_sugerido: number;
  comentario: string | null;
  atendido: boolean;
  created_at: string;
}

export interface Revisao {
  id: string;
  config_id: string;
  produto_id: string;
  status: string;
  snapshot_insumos: any;
  snapshot_config: any;
  snapshot_totais: any;
  submetido_por: string | null;
  submetido_em: string;
  revisado_por: string | null;
  revisado_em: string | null;
  parecer: string | null;
  versao: number;
  created_at: string;
}

export function useFichaRevisao(produtoId: string | undefined, configId: string | undefined) {
  const [submitting, setSubmitting] = useState(false);

  // Buscar revisão ativa
  const { data: revisaoAtiva, refetch: refetchRevisao } = useSupabaseQuery(
    ["ficha-revisao-ativa", configId],
    async () => {
      if (!configId) return null;
      const { data, error } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("*")
        .eq("config_id", configId)
        .in("status", ["pendente", "revisao_solicitada"])
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) { console.error(error); return null; }
      return data as Revisao | null;
    },
    { enabled: !!configId }
  );

  // Buscar apontamentos da revisão ativa
  const { data: apontamentos, refetch: refetchApontamentos } = useSupabaseQuery(
    ["ficha-revisao-itens", revisaoAtiva?.id],
    async () => {
      if (!revisaoAtiva?.id) return [];
      const { data, error } = await supabase
        .from("fabrica_ficha_custo_revisao_itens")
        .select("*")
        .eq("revisao_id", revisaoAtiva.id);
      if (error) { console.error(error); return []; }
      return (data || []) as RevisaoItem[];
    },
    { enabled: !!revisaoAtiva?.id }
  );

  // Buscar requisitos obrigatórios da revisão ativa
  const { data: requisitos, refetch: refetchRequisitos } = useSupabaseQuery(
    ["ficha-revisao-requisitos", revisaoAtiva?.id],
    async () => {
      if (!revisaoAtiva?.id) return [];
      const { data, error } = await supabase
        .from("fabrica_revisao_requisitos" as any)
        .select("*")
        .eq("revisao_id", revisaoAtiva.id);
      if (error) { console.error(error); return []; }
      return (data || []) as any[];
    },
    { enabled: !!revisaoAtiva?.id }
  );

  // Buscar status_aprovacao da config
  const { data: statusAprovacao, refetch: refetchStatus } = useSupabaseQuery(
    ["ficha-status-aprovacao", configId],
    async () => {
      if (!configId) return "rascunho" as StatusAprovacao;
      const { data, error } = await supabase
        .from("fabrica_produto_custos_config")
        .select("status_aprovacao")
        .eq("id", configId)
        .single();
      if (error) return "rascunho" as StatusAprovacao;
      return (data?.status_aprovacao || "rascunho") as StatusAprovacao;
    },
    { enabled: !!configId }
  );

  // Função auxiliar para calcular totais simples de uma ficha
  const calcularTotaisSimples = (insumosArr: any[], configObj: any) => {
    let totalNF = 0, totalServico = 0, totalCondicao = 0;
    insumosArr.forEach((i: any) => {
      totalNF += Number(i.custo_nf) || 0;
      totalServico += Number(i.custo_servico) || 0;
      totalCondicao += Number(i.custo_condicao) || 0;
    });
    totalNF += Number(configObj.custo_mao_obra_nf) || 0;
    totalServico += Number(configObj.custo_mao_obra_servico) || 0;

    const perc = Number(configObj.percentual_markup) || 0;
    const base = configObj.base_calculo_markup || "nf_servico";
    let baseMarkup = 0;
    if (base === "total") baseMarkup = totalNF + totalServico + totalCondicao;
    else if (base === "nf") baseMarkup = totalNF;
    else if (base === "servico") baseMarkup = totalServico;
    else baseMarkup = totalNF + totalServico;

    const markupValor = baseMarkup * (perc / 100);
    const custoTotal = totalNF + totalServico + totalCondicao + markupValor;

    return { totalNF, totalServico, totalCondicao, markupNF: base === "nf" || base === "nf_servico" || base === "total" ? markupValor * (totalNF / (baseMarkup || 1)) : 0, markupServico: 0, markupCondicao: 0, custoTotal };
  };

  // Função auxiliar para submeter uma única ficha
  const submeterFichaUnica = async (
    cfgId: string, prodId: string,
    insumosArr: CustoInsumo[], configObj: CustoConfig, totaisObj: any,
    userId: string | null
  ) => {
    const { data: ultimaRevisao } = await supabase
      .from("fabrica_ficha_custo_revisoes")
      .select("versao")
      .eq("config_id", cfgId)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const novaVersao = (ultimaRevisao?.versao || 0) + 1;

    // Buscar alterações recentes
    const insumoIds = insumosArr.map(i => i.id);
    let alteracoesPendentes: any[] = [];
    if (insumoIds.length > 0) {
      const { data: alteracoes } = await supabase
        .from("fabrica_insumo_custo_historico" as any)
        .select("*")
        .in("produto_custo_id", insumoIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (alteracoes) {
        alteracoesPendentes = (alteracoes as any[]).map((a: any) => ({
          insumo_id: a.produto_custo_id,
          insumo_nome: insumosArr.find(i => i.id === a.produto_custo_id)?.nome || "",
          campo: a.campo, valor_anterior: a.valor_anterior, valor_novo: a.valor_novo,
          motivo: a.motivo, usuario_nome: a.usuario_nome, data: a.created_at,
        }));
      }
    }

    const { data: revisao, error } = await supabase
      .from("fabrica_ficha_custo_revisoes")
      .insert({
        config_id: cfgId, produto_id: prodId, status: "pendente",
        snapshot_insumos: insumosArr as any, snapshot_config: configObj as any,
        snapshot_totais: { ...totaisObj, alteracoes_pendentes: alteracoesPendentes } as any,
        submetido_por: userId, versao: novaVersao,
      })
      .select().single();

    if (error) throw error;

    await supabase
      .from("fabrica_produto_custos_config")
      .update({ status_aprovacao: "em_revisao", revisao_ativa_id: revisao.id })
      .eq("id", cfgId);

    return revisao;
  };

  // Submeter para aprovação (inclui filhos vinculados se Display/Kit)
  const submeterParaAprovacao = useCallback(async (
    insumos: CustoInsumo[],
    config: CustoConfig,
    totais: Totais,
  ) => {
    if (!produtoId || !configId) return;
    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Submeter a ficha principal
      await submeterFichaUnica(configId, produtoId, insumos, config, totais, user?.user?.id || null);

      // Verificar se é um Display/Kit e submeter filhos vinculados
      const { data: gradeItens } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("produto_filho_id")
        .eq("produto_pai_id", produtoId);

      if (gradeItens && gradeItens.length > 0) {
        const filhoIds = [...new Set((gradeItens as any[]).map((g: any) => g.produto_filho_id))];
        
        for (const filhoId of filhoIds) {
          try {
            // Buscar config do filho
            const { data: filhoConfig } = await supabase
              .from("fabrica_produto_custos_config")
              .select("*")
              .eq("produto_id", filhoId)
              .maybeSingle();

            // Filhos já em_revisao serão re-submetidos junto com o Kit pai

            let configParaUsar = filhoConfig;

            // Se o filho não tem config, criar uma com valores padrão
            if (!configParaUsar) {
              const { data: novoConfig, error: errConfig } = await supabase
                .from("fabrica_produto_custos_config")
                .insert({
                  produto_id: filhoId,
                  margem_lucro: 0,
                  impostos_percentual: 0,
                  frete_percentual: 0,
                  comissao_percentual: 0,
                  markup_desejado: 0,
                  status_aprovacao: "rascunho",
                })
                .select()
                .single();

              if (errConfig || !novoConfig) {
                console.warn(`Não foi possível criar config para filho ${filhoId}:`, errConfig);
                continue;
              }
              configParaUsar = novoConfig;
            }

            // Buscar insumos do filho (pode ser vazio)
            const { data: filhoInsumos } = await supabase
              .from("fabrica_produto_custos")
              .select("*")
              .eq("produto_id", filhoId)
              .order("ordem");

            const insumosParaUsar = (filhoInsumos || []) as any[];

            // Calcular totais do filho
            const filhoTotais = calcularTotaisSimples(insumosParaUsar, configParaUsar as any);

            await submeterFichaUnica(
              configParaUsar.id, filhoId,
              insumosParaUsar, configParaUsar as any, filhoTotais,
              user?.user?.id || null
            );
          } catch (err) {
            console.warn(`Erro ao submeter filho ${filhoId}:`, err);
          }
        }
      }

      toast.success("Ficha submetida para aprovação da Diretoria!");
      refetchRevisao();
      refetchStatus();
    } catch (err: any) {
      console.error("Erro ao submeter:", err);
      toast.error("Erro ao submeter: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }, [produtoId, configId, refetchRevisao, refetchStatus]);

  const refetchAll = useCallback(() => {
    refetchRevisao();
    refetchApontamentos();
    refetchRequisitos();
    refetchStatus();
  }, [refetchRevisao, refetchApontamentos, refetchRequisitos, refetchStatus]);

  return {
    statusAprovacao: statusAprovacao || "rascunho" as StatusAprovacao,
    revisaoAtiva,
    apontamentos: apontamentos || [],
    requisitos: requisitos || [],
    submitting,
    submeterParaAprovacao,
    refetchAll,
  };
}

// Hook for the Diretoria review page
export function useFichaRevisaoDiretoria() {
  const [processando, setProcessando] = useState(false);
  const queryClient = useQueryClient();

  const { data: fichasPendentes, isLoading, refetch } = useSupabaseQuery(
    ["fichas-pendentes-diretoria"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select(`
          *,
          produto:fabrica_produtos(id, nome, codigo, origem, marca, linha)
        `)
        .eq("status", "pendente")
        .order("submetido_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    { refetchInterval: 30000 }
  );

  // Realtime: auto-refresh when revisoes change
  useEffect(() => {
    const channel = supabase
      .channel('revisoes-diretoria')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fabrica_ficha_custo_revisoes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["fichas-pendentes-diretoria"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const aprovarFicha = useCallback(async (revisaoId: string, configId: string, parecer: string) => {
    setProcessando(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      await supabase
        .from("fabrica_ficha_custo_revisoes")
        .update({
          status: "aprovada",
          revisado_por: user?.user?.id || null,
          revisado_em: new Date().toISOString(),
          parecer,
        })
        .eq("id", revisaoId);

      await supabase
        .from("fabrica_produto_custos_config")
        .update({
          status_aprovacao: "aprovada",
          revisao_ativa_id: null,
        })
        .eq("id", configId);

      toast.success("Ficha aprovada com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error("Erro ao aprovar: " + err.message);
    } finally {
      setProcessando(false);
    }
  }, [refetch]);

  const solicitarRevisao = useCallback(async (
    revisaoId: string,
    configId: string,
    parecer: string,
    itens: { insumo_id: string; campo: string; valor_atual: number; valor_sugerido: number; comentario: string }[],
    requisitos: { tipo: string; descricao: string; quantidade_minima: number; insumo_id: string | null }[] = []
  ) => {
    setProcessando(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Atualizar revisão
      await supabase
        .from("fabrica_ficha_custo_revisoes")
        .update({
          status: "revisao_solicitada",
          revisado_por: user?.user?.id || null,
          revisado_em: new Date().toISOString(),
          parecer,
        })
        .eq("id", revisaoId);

      // Inserir apontamentos
      if (itens.length > 0) {
        const rows = itens.map(item => ({
          revisao_id: revisaoId,
          insumo_id: item.insumo_id,
          campo: item.campo,
          valor_atual: item.valor_atual,
          valor_sugerido: item.valor_sugerido,
          comentario: item.comentario,
        }));
        await supabase.from("fabrica_ficha_custo_revisao_itens").insert(rows);
      }

      // Inserir requisitos obrigatórios
      if (requisitos.length > 0) {
        const reqRows = requisitos.map(r => ({
          revisao_id: revisaoId,
          tipo: r.tipo,
          descricao: r.descricao,
          quantidade_minima: r.quantidade_minima,
          insumo_id: r.insumo_id || null,
          criado_por: user?.user?.id || null,
          criado_por_nome: user?.user?.user_metadata?.nome || user?.user?.email || "Diretor",
        }));
        await supabase.from("fabrica_revisao_requisitos" as any).insert(reqRows as any);
      }

      // Atualizar config
      await supabase
        .from("fabrica_produto_custos_config")
        .update({ status_aprovacao: "revisao_solicitada" })
        .eq("id", configId);

      toast.success("Revisão solicitada com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setProcessando(false);
    }
  }, [refetch]);

  return {
    fichasPendentes: fichasPendentes || [],
    isLoading,
    processando,
    aprovarFicha,
    solicitarRevisao,
    refetch,
  };
}
