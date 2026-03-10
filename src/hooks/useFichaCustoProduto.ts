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

export type BaseCalculoMarkup = 'total' | 'nf' | 'servico' | 'nf_servico';

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
  { value: "importado_kit", label: "Produto do Kit" },
  { value: "outro", label: "Outro" },
];

export interface CustoFilho {
  produtoFilhoId: string;
  produtoFilhoNome: string;
  produtoFilhoCodigo: string;
  quantidade: number;
  custoUnitarioTotal: number;
  custoTotalLinha: number;
}

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
    } else {
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

  // Verificar se produto é DISPLAY com insumos importados do kit
  const isDisplayComKit = useMemo(() => {
    return produto?.tipo === 'DISPLAY' && insumos.some(i => i.tipo_insumo === 'importado_kit');
  }, [produto?.tipo, insumos]);

  const todosInsumosKit = useMemo(() => {
    return insumos.length > 0 && insumos.every(i => i.tipo_insumo === 'importado_kit');
  }, [insumos]);

  // Calcular totais
  const totais = useMemo<Totais>(() => {
    // Separar insumos kit vs não-kit
    const insumosKit = insumos.filter(i => i.tipo_insumo === 'importado_kit');
    const insumosNaoKit = insumos.filter(i => i.tipo_insumo !== 'importado_kit');

    // Insumos do kit (M.O. e Markup já embutidos no custo unitário)
    const kitNF = insumosKit.reduce((acc, i) => acc + (Number(i.custo_nf) || 0), 0);
    const kitServico = insumosKit.reduce((acc, i) => acc + (Number(i.custo_servico) || 0), 0);
    const kitCondicao = insumosKit.reduce((acc, i) => acc + (Number(i.custo_condicao) || 0), 0);

    // Insumos normais (recebem M.O. e Markup)
    const normalNF = insumosNaoKit.reduce((acc, i) => acc + (Number(i.custo_nf) || 0), 0);
    const normalServico = insumosNaoKit.reduce((acc, i) => acc + (Number(i.custo_servico) || 0), 0);
    const normalCondicao = insumosNaoKit.reduce((acc, i) => acc + (Number(i.custo_condicao) || 0), 0);

    // M.O. aplicada SOMENTE sobre insumos não-kit (para DISPLAY com kit)
    const moNF = isDisplayComKit && todosInsumosKit ? 0 : (Number(config?.custo_mao_obra_nf) || 0);
    const moServico = isDisplayComKit && todosInsumosKit ? 0 : (Number(config?.custo_mao_obra_servico) || 0);

    const totalNF = kitNF + normalNF + moNF;
    const totalServico = kitServico + normalServico + moServico;
    const totalCondicao = kitCondicao + normalCondicao;

    const subtotal = totalNF + totalServico + totalCondicao;

    // Markup - aplicado SOMENTE sobre insumos não-kit (para DISPLAY com kit)
    const percentualMarkup = Number(config?.percentual_markup) || 0;
    const baseMarkup = config?.base_calculo_markup || 'total';

    // Base para markup: somente a parte normal (não-kit) + M.O.
    const baseNFMarkup = isDisplayComKit ? (normalNF + moNF) : totalNF;
    const baseServicoMarkup = isDisplayComKit ? (normalServico + moServico) : totalServico;
    const baseCondicaoMarkup = isDisplayComKit ? normalCondicao : totalCondicao;
    
    const markupNF = (baseMarkup === 'total' || baseMarkup === 'nf' || baseMarkup === 'nf_servico') 
      ? baseNFMarkup * (percentualMarkup / 100) : 0;
    const markupServico = (baseMarkup === 'total' || baseMarkup === 'servico' || baseMarkup === 'nf_servico') 
      ? baseServicoMarkup * (percentualMarkup / 100) : 0;
    const markupCondicao = baseMarkup === 'total' 
      ? baseCondicaoMarkup * (percentualMarkup / 100) : 0;
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
  }, [insumos, config, isDisplayComKit, todosInsumosKit]);

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

      // Não salvar no banco se é string intermediária (ex: "0.0", "1.")
      const isIntermediateString = typeof valor === "string" && (valor.endsWith(".") || /\.\d*0$/.test(valor) || valor === "");
      if (isIntermediateString) return;

      const dbValue = typeof valor === "string" ? (parseFloat(valor) || 0) : valor;
      const { error } = await supabase
        .from("fabrica_produto_custos")
        .update({ [campo]: dbValue })
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

  // Carregar custos dos filhos (para Displays/Kits)
  const [custosFilhos, setCustosFilhos] = useState<CustoFilho[]>([]);
  const [loadingFilhos, setLoadingFilhos] = useState(false);

  const carregarCustosFilhos = useCallback(async () => {
    if (!produtoId || produto?.tipo !== "DISPLAY") {
      setCustosFilhos([]);
      return;
    }

    setLoadingFilhos(true);
    try {
      // Buscar itens da grade
      const { data: gradeItens, error: gradeError } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("produto_filho_id, quantidade, produto_filho:fabrica_produtos!produto_filho_id(nome, codigo)")
        .eq("produto_pai_id", produtoId)
        .order("ordem");

      if (gradeError || !gradeItens?.length) {
        setCustosFilhos([]);
        return;
      }

      // Para cada filho, calcular custo total
      const filhosComCusto: CustoFilho[] = [];
      for (const item of gradeItens) {
        const filhoId = item.produto_filho_id;
        const filho = item.produto_filho as any;

        // Buscar insumos do filho
        const { data: insumosFilho } = await supabase
          .from("fabrica_produto_custos")
          .select("custo_nf, custo_servico, custo_condicao")
          .eq("produto_id", filhoId);

        // Buscar config do filho
        const { data: configFilho } = await supabase
          .from("fabrica_produto_custos_config")
          .select("custo_mao_obra_nf, custo_mao_obra_servico, percentual_markup, base_calculo_markup")
          .eq("produto_id", filhoId)
          .maybeSingle();

        // Calcular custo unitário total do filho
        const totalNFIns = (insumosFilho || []).reduce((s, i) => s + (Number(i.custo_nf) || 0), 0);
        const totalServIns = (insumosFilho || []).reduce((s, i) => s + (Number(i.custo_servico) || 0), 0);
        const totalCondIns = (insumosFilho || []).reduce((s, i) => s + (Number(i.custo_condicao) || 0), 0);
        const moNF = Number(configFilho?.custo_mao_obra_nf) || 0;
        const moServ = Number(configFilho?.custo_mao_obra_servico) || 0;
        const tNF = totalNFIns + moNF;
        const tServ = totalServIns + moServ;
        const tCond = totalCondIns;
        const subtotal = tNF + tServ + tCond;
        const pctMarkup = Number(configFilho?.percentual_markup) || 0;
        const baseMarkup = (configFilho?.base_calculo_markup as BaseCalculoMarkup) || 'total';
        const mNF = (baseMarkup === 'total' || baseMarkup === 'nf' || baseMarkup === 'nf_servico') ? tNF * (pctMarkup / 100) : 0;
        const mServ = (baseMarkup === 'total' || baseMarkup === 'servico' || baseMarkup === 'nf_servico') ? tServ * (pctMarkup / 100) : 0;
        const mCond = baseMarkup === 'total' ? tCond * (pctMarkup / 100) : 0;
        const custoUnit = subtotal + mNF + mServ + mCond;

        filhosComCusto.push({
          produtoFilhoId: filhoId,
          produtoFilhoNome: filho?.nome || "",
          produtoFilhoCodigo: filho?.codigo || "",
          quantidade: item.quantidade || 1,
          custoUnitarioTotal: custoUnit,
          custoTotalLinha: custoUnit * (item.quantidade || 1),
        });
      }

      setCustosFilhos(filhosComCusto);
    } catch (err) {
      console.error("Erro ao carregar custos dos filhos:", err);
    } finally {
      setLoadingFilhos(false);
    }
  }, [produtoId, produto?.tipo]);

  // Carregar custos dos filhos quando produto carregar
  useEffect(() => {
    if (produto?.tipo === "DISPLAY") {
      carregarCustosFilhos();
    }
  }, [produto?.tipo, carregarCustosFilhos]);

  // Importar custos dos filhos como insumos editáveis
  const importarCustosFilhos = useCallback(async () => {
    if (!produtoId || custosFilhos.length === 0) return;

    for (const filho of custosFilhos) {
      await adicionarInsumo({
        codigo: filho.produtoFilhoCodigo,
        nome: `${filho.produtoFilhoNome} (×${filho.quantidade})`,
        tipo_insumo: "importado_kit",
        custo_nf: filho.custoTotalLinha,
        custo_servico: 0,
        custo_condicao: 0,
        fornecedor: "Importado do Kit",
      });
    }

    // Auto-zerar M.O. e Markup do Display, pois já estão embutidos nos custos dos filhos
    if (config) {
      const novaConfig = {
        ...config,
        custo_mao_obra_nf: 0,
        custo_mao_obra_servico: 0,
        percentual_markup: 0,
      };
      setConfig(novaConfig);

      if (config.id) {
        await supabase
          .from("fabrica_produto_custos_config")
          .update({
            custo_mao_obra_nf: 0,
            custo_mao_obra_servico: 0,
            percentual_markup: 0,
          })
          .eq("id", config.id);
      }

      toast.info("M.O. e Markup zerados — valores já incluídos nos custos importados dos filhos");
    }

    toast.success(`${custosFilhos.length} produto(s) importado(s) para a ficha`);
  }, [produtoId, custosFilhos, adicionarInsumo, config]);

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
    custosFilhos,
    loadingFilhos,
    importarCustosFilhos,
    carregarCustosFilhos,
    isDisplayComKit,
    todosInsumosKit,
  };
}
