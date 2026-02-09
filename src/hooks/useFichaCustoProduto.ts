import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CustoInsumo {
  id: string;
  produto_id: string;
  mp_id: string | null;
  codigo: string;
  nome: string;
  fornecedor: string | null;
  tipo_insumo: string;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  nf_referencia: string | null;
  ordem: number;
}

export type BaseCalculoMarkup = 'total' | 'nf' | 'servico';

export interface CustoConfig {
  id: string;
  produto_id: string;
  fornecedor_mao_obra: string | null;
  custo_mao_obra_nf: number;
  custo_mao_obra_servico: number;
  percentual_markup: number;
  base_calculo_markup: BaseCalculoMarkup;
  observacoes: string | null;
}

export interface Totais {
  totalNF: number;
  totalServico: number;
  totalCondicao: number;
  subtotal: number;
  markupNF: number;
  markupServico: number;
  markupCondicao: number;
  markupTotal: number;
  custoTotal: number;
}

const TIPOS_INSUMO = [
  { value: "bulk", label: "Bulk" },
  { value: "embalagem_primaria", label: "Emb. Primária" },
  { value: "embalagem_secundaria", label: "Emb. Secundária" },
  { value: "rotulo", label: "Rótulo" },
  { value: "acessorio", label: "Acessório" },
  { value: "outro", label: "Outro" },
];

export function useFichaCustoProduto(produtoId: string | undefined) {
  const [produto, setProduto] = useState<any>(null);
  const [insumos, setInsumos] = useState<CustoInsumo[]>([]);
  const [config, setConfig] = useState<CustoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar dados do produto
  const carregarProduto = useCallback(async () => {
    if (!produtoId) return;

    const { data, error } = await supabase
      .from("fabrica_produtos")
      .select("*, unidade:fabrica_unidades_medida(sigla, nome)")
      .eq("id", produtoId)
      .single();

    if (error) {
      console.error("Erro ao carregar produto:", error);
      toast.error("Erro ao carregar produto");
      return;
    }

    setProduto(data);
  }, [produtoId]);

  // Carregar insumos do produto
  const carregarInsumos = useCallback(async () => {
    if (!produtoId) return;

    const { data, error } = await supabase
      .from("fabrica_produto_custos")
      .select("*")
      .eq("produto_id", produtoId)
      .order("ordem", { ascending: true });

    if (error) {
      console.error("Erro ao carregar insumos:", error);
      return;
    }

    setInsumos(data || []);
  }, [produtoId]);

  // Carregar configuração
  const carregarConfig = useCallback(async () => {
    if (!produtoId) return;

    const { data, error } = await supabase
      .from("fabrica_produto_custos_config")
      .select("*")
      .eq("produto_id", produtoId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar config:", error);
      return;
    }

    if (data) {
      setConfig({
        ...data,
        base_calculo_markup: (data.base_calculo_markup as BaseCalculoMarkup) || 'total',
      });
      // Criar config padrão
      setConfig({
        id: "",
        produto_id: produtoId,
        fornecedor_mao_obra: null,
        custo_mao_obra_nf: 0,
        custo_mao_obra_servico: 0,
        percentual_markup: 10,
        base_calculo_markup: "total",
        observacoes: null,
      });
    }
  }, [produtoId]);

  // Carregar tudo
  const carregarDados = useCallback(async () => {
    setLoading(true);
    await Promise.all([carregarProduto(), carregarInsumos(), carregarConfig()]);
    setLoading(false);
  }, [carregarProduto, carregarInsumos, carregarConfig]);

  useEffect(() => {
    if (produtoId) {
      carregarDados();
    }
  }, [produtoId, carregarDados]);

  // Calcular totais
  const totais = useMemo<Totais>(() => {
    // Soma dos insumos
    const totalNFInsumos = insumos.reduce((acc, i) => acc + (Number(i.custo_nf) || 0), 0);
    const totalServicoInsumos = insumos.reduce((acc, i) => acc + (Number(i.custo_servico) || 0), 0);
    const totalCondicaoInsumos = insumos.reduce((acc, i) => acc + (Number(i.custo_condicao) || 0), 0);

    // Adicionar M.O.
    const moNF = Number(config?.custo_mao_obra_nf) || 0;
    const moServico = Number(config?.custo_mao_obra_servico) || 0;

    const totalNF = totalNFInsumos + moNF;
    const totalServico = totalServicoInsumos + moServico;
    const totalCondicao = totalCondicaoInsumos;

    const subtotal = totalNF + totalServico + totalCondicao;

    // Markup - baseado na opção selecionada
    const percentualMarkup = Number(config?.percentual_markup) || 0;
    const baseMarkup = config?.base_calculo_markup || 'total';
    
    const markupNF = (baseMarkup === 'total' || baseMarkup === 'nf') 
      ? totalNF * (percentualMarkup / 100) : 0;
    const markupServico = (baseMarkup === 'total' || baseMarkup === 'servico') 
      ? totalServico * (percentualMarkup / 100) : 0;
    const markupCondicao = baseMarkup === 'total' 
      ? totalCondicao * (percentualMarkup / 100) : 0;
    const markupTotal = markupNF + markupServico + markupCondicao;

    const custoTotal = subtotal + markupTotal;

    return {
      totalNF,
      totalServico,
      totalCondicao,
      subtotal,
      markupNF,
      markupServico,
      markupCondicao,
      markupTotal,
      custoTotal,
    };
  }, [insumos, config]);

  // Adicionar insumo
  const adicionarInsumo = useCallback(
    async (insumo: Partial<CustoInsumo>) => {
      if (!produtoId) return;

      const novoInsumo = {
        produto_id: produtoId,
        codigo: insumo.codigo || "",
        nome: insumo.nome || "",
        fornecedor: insumo.fornecedor || null,
        tipo_insumo: insumo.tipo_insumo || "bulk",
        custo_nf: insumo.custo_nf || 0,
        custo_servico: insumo.custo_servico || 0,
        custo_condicao: insumo.custo_condicao || 0,
        nf_referencia: insumo.nf_referencia || null,
        mp_id: insumo.mp_id || null,
        ordem: insumos.length,
      };

      const { data, error } = await supabase
        .from("fabrica_produto_custos")
        .insert(novoInsumo)
        .select()
        .single();

      if (error) {
        console.error("Erro ao adicionar insumo:", error);
        toast.error("Erro ao adicionar insumo");
        return;
      }

      setInsumos((prev) => [...prev, data]);
      toast.success("Insumo adicionado");
    },
    [produtoId, insumos.length]
  );

  // Atualizar insumo
  const atualizarInsumo = useCallback(
    async (id: string, campo: keyof CustoInsumo, valor: any) => {
      // Atualizar localmente primeiro para UX rápida
      setInsumos((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i))
      );

      const { error } = await supabase
        .from("fabrica_produto_custos")
        .update({ [campo]: valor })
        .eq("id", id);

      if (error) {
        console.error("Erro ao atualizar insumo:", error);
        toast.error("Erro ao atualizar");
        carregarInsumos(); // Reverter
      }
    },
    [carregarInsumos]
  );

  // Remover insumo
  const removerInsumo = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("fabrica_produto_custos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao remover insumo:", error);
      toast.error("Erro ao remover insumo");
      return;
    }

    setInsumos((prev) => prev.filter((i) => i.id !== id));
    toast.success("Insumo removido");
  }, []);

  // Atualizar config
  const atualizarConfig = useCallback(
    (campo: keyof CustoConfig, valor: any) => {
      setConfig((prev) => (prev ? { ...prev, [campo]: valor } : null));
    },
    []
  );

  // Salvar tudo
  const salvarFicha = useCallback(async () => {
    if (!produtoId || !config) return;

    setSaving(true);

    try {
      // Salvar ou atualizar config
      if (config.id) {
        const { error } = await supabase
          .from("fabrica_produto_custos_config")
          .update({
            fornecedor_mao_obra: config.fornecedor_mao_obra,
            custo_mao_obra_nf: config.custo_mao_obra_nf,
            custo_mao_obra_servico: config.custo_mao_obra_servico,
            percentual_markup: config.percentual_markup,
            base_calculo_markup: config.base_calculo_markup,
            observacoes: config.observacoes,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("fabrica_produto_custos_config")
          .insert({
            produto_id: produtoId,
            fornecedor_mao_obra: config.fornecedor_mao_obra,
            custo_mao_obra_nf: config.custo_mao_obra_nf,
            custo_mao_obra_servico: config.custo_mao_obra_servico,
            percentual_markup: config.percentual_markup,
            base_calculo_markup: config.base_calculo_markup,
            observacoes: config.observacoes,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig({ ...data, base_calculo_markup: (data.base_calculo_markup as BaseCalculoMarkup) || 'total' });
      }

      toast.success("Ficha de custos salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar ficha:", error);
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  }, [produtoId, config, totais.custoTotal]);

  // Reordenar insumos
  const reordenarInsumos = useCallback(
    async (novaOrdem: CustoInsumo[]) => {
      setInsumos(novaOrdem);

      // Atualizar ordem no banco
      const updates = novaOrdem.map((insumo, index) => ({
        id: insumo.id,
        ordem: index,
      }));

      for (const update of updates) {
        await supabase
          .from("fabrica_produto_custos")
          .update({ ordem: update.ordem })
          .eq("id", update.id);
      }
    },
    []
  );

  return {
    produto,
    insumos,
    config,
    totais,
    loading,
    saving,
    adicionarInsumo,
    atualizarInsumo,
    removerInsumo,
    atualizarConfig,
    salvarFicha,
    reordenarInsumos,
    recarregar: carregarDados,
    TIPOS_INSUMO,
  };
}
