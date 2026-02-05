import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularPrecoComMarkup,
  calcularMargemLucro,
  MarkupConfig,
} from "@/lib/fabrica/pricing-calculator";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface CenarioSimulacao {
  id?: string;
  nome: string;
  descricao?: string;
  tabela_base_id?: string;
  tipo_markup: 'percentual' | 'multiplicador' | 'valor_fixo';
  valor_markup: number;
  origem?: 'nacional' | 'importado' | 'ambos';
}

export interface ResultadoSimulacao {
  produto_id: string;
  produto_nome: string;
  produto_codigo: string;
  categoria?: string;
  custo_base: number;
  preco_atual: number;
  preco_simulado: number;
  variacao_absoluta: number;
  variacao_percentual: number;
  margem_atual: number;
  margem_simulada: number;
}

export interface ImpactoCadeia {
  tabela_id: string;
  tabela_nome: string;
  nivel: number;
  preco_medio_atual: number;
  preco_medio_simulado: number;
  variacao_percentual: number;
  produtos_afetados: number;
  dependentes: ImpactoCadeia[];
}

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
}

export function useSimuladorPrecos() {
  const [cenarioBase, setCenarioBase] = useState<CenarioSimulacao | null>(null);
  const [cenarioSimulacao, setCenarioSimulacao] = useState<CenarioSimulacao | null>(null);
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [resultados, setResultados] = useState<ResultadoSimulacao[]>([]);
  const [impactoCadeia, setImpactoCadeia] = useState<ImpactoCadeia[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Buscar tabelas disponíveis
  const { data: tabelas = [] } = useQuery({
    queryKey: ['simulador-tabelas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_tabelas_preco')
        .select('id, nome, tipo_markup, valor_markup, tabela_base_id, ordem')
        .eq('ativo', true)
        .order('ordem');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar produtos
  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['simulador-produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_produtos')
        .select('id, codigo, nome, categoria')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return (data || []) as Produto[];
    },
  });

  // Função para buscar preços de uma tabela
  const buscarPrecos = async (tabelaId: string, produtosIds: string[], origem?: string) => {
    let query = supabase
      .from('fabrica_precos_produtos')
      .select('produto_id, preco_final, custo_base')
      .eq('tabela_id', tabelaId)
      .eq('ativo', true)
      .in('produto_id', produtosIds);

    if (origem && origem !== 'ambos') {
      query = query.eq('origem', origem);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  // Função para buscar custos de origem
  const buscarCustosOrigem = async (produtosIds: string[], origem: 'nacional' | 'importado') => {
    const { data, error } = await supabase
      .from('fabrica_custos_origem')
      .select('produto_id, custo_base')
      .eq('origem', origem)
      .eq('ativo', true)
      .in('produto_id', produtosIds);
    
    if (error) throw error;
    return data || [];
  };

  // Recalcular simulação
  const recalcular = useCallback(async () => {
    if (!cenarioSimulacao || produtosSelecionados.length === 0) return;

    setIsLoading(true);
    try {
      const resultadosCalculados: ResultadoSimulacao[] = [];
      
      // Buscar preços atuais (base)
      let precosBase: Record<string, { preco: number; custo: number }> = {};
      
      if (cenarioBase?.tabela_base_id) {
        const precos = await buscarPrecos(
          cenarioBase.tabela_base_id,
          produtosSelecionados,
          cenarioBase.origem
        );
        precos.forEach(p => {
          precosBase[p.produto_id] = {
            preco: Number(p.preco_final) || 0,
            custo: Number(p.custo_base) || 0,
          };
        });
      }

      // Buscar custos base para simulação
      let custosSimulacao: Record<string, number> = {};
      
      if (cenarioSimulacao.tabela_base_id) {
        // Usar preço da tabela base como custo
        const precosTabela = await buscarPrecos(
          cenarioSimulacao.tabela_base_id,
          produtosSelecionados,
          cenarioSimulacao.origem
        );
        precosTabela.forEach(p => {
          custosSimulacao[p.produto_id] = Number(p.preco_final) || 0;
        });
      } else if (cenarioSimulacao.origem && cenarioSimulacao.origem !== 'ambos') {
        // Usar custo de origem
        const custos = await buscarCustosOrigem(
          produtosSelecionados,
          cenarioSimulacao.origem as 'nacional' | 'importado'
        );
        custos.forEach(c => {
          custosSimulacao[c.produto_id] = Number(c.custo_base) || 0;
        });
      }

      // Calcular preços simulados
      for (const produtoId of produtosSelecionados) {
        const produto = produtos.find(p => p.id === produtoId);
        if (!produto) continue;

        const custoBase = custosSimulacao[produtoId] || 0;
        const precoAtual = precosBase[produtoId]?.preco || 0;
        
        const precoSimulado = calcularPrecoComMarkup(custoBase, {
          tipo: cenarioSimulacao.tipo_markup,
          valor: cenarioSimulacao.valor_markup,
        });

        const margemAtual = precoAtual > 0 ? calcularMargemLucro(precosBase[produtoId]?.custo || custoBase, precoAtual) : 0;
        const margemSimulada = precoSimulado > 0 ? calcularMargemLucro(custoBase, precoSimulado) : 0;

        resultadosCalculados.push({
          produto_id: produtoId,
          produto_nome: produto.nome,
          produto_codigo: produto.codigo,
          categoria: produto.categoria || undefined,
          custo_base: custoBase,
          preco_atual: precoAtual,
          preco_simulado: precoSimulado,
          variacao_absoluta: precoSimulado - precoAtual,
          variacao_percentual: precoAtual > 0 ? ((precoSimulado - precoAtual) / precoAtual) * 100 : 0,
          margem_atual: margemAtual,
          margem_simulada: margemSimulada,
        });
      }

      setResultados(resultadosCalculados);

      // Calcular impacto na cadeia
      if (cenarioSimulacao.tabela_base_id) {
        const impacto = await calcularImpactoCadeiaInterno(
          cenarioSimulacao.tabela_base_id,
          resultadosCalculados
        );
        setImpactoCadeia(impacto);
      }
    } catch (error) {
      console.error('Erro ao recalcular simulação:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cenarioBase, cenarioSimulacao, produtosSelecionados, produtos]);

  // Calcular impacto na cadeia
  const calcularImpactoCadeiaInterno = async (
    tabelaBaseId: string,
    resultadosSimulacao: ResultadoSimulacao[]
  ): Promise<ImpactoCadeia[]> => {
    // Buscar tabelas dependentes
    const { data: tabelasDependentes } = await supabase
      .from('fabrica_tabelas_preco')
      .select('id, nome, tipo_markup, valor_markup, tabela_base_id, ordem')
      .eq('tabela_base_id', tabelaBaseId)
      .eq('ativo', true)
      .order('ordem');

    if (!tabelasDependentes || tabelasDependentes.length === 0) return [];

    const impactos: ImpactoCadeia[] = [];

    for (const tabela of tabelasDependentes) {
      // Calcular preço médio atual da tabela
      const { data: precosAtuais } = await supabase
        .from('fabrica_precos_produtos')
        .select('preco_final')
        .eq('tabela_id', tabela.id)
        .eq('ativo', true);

      const precoMedioAtual = precosAtuais?.length
        ? precosAtuais.reduce((acc, p) => acc + Number(p.preco_final), 0) / precosAtuais.length
        : 0;

      // Calcular preço médio simulado (aplicando markup nos resultados)
      const precoMedioBase = resultadosSimulacao.length
        ? resultadosSimulacao.reduce((acc, r) => acc + r.preco_simulado, 0) / resultadosSimulacao.length
        : 0;

      const precoMedioSimulado = calcularPrecoComMarkup(precoMedioBase, {
        tipo: tabela.tipo_markup as MarkupConfig['tipo'],
        valor: Number(tabela.valor_markup),
      });

      const variacaoPercentual = precoMedioAtual > 0
        ? ((precoMedioSimulado - precoMedioAtual) / precoMedioAtual) * 100
        : 0;

      // Buscar dependentes recursivamente
      const dependentes = await calcularImpactoCadeiaInterno(tabela.id, resultadosSimulacao);

      impactos.push({
        tabela_id: tabela.id,
        tabela_nome: tabela.nome,
        nivel: 1,
        preco_medio_atual: precoMedioAtual,
        preco_medio_simulado: precoMedioSimulado,
        variacao_percentual: variacaoPercentual,
        produtos_afetados: resultadosSimulacao.length,
        dependentes,
      });
    }

    return impactos;
  };

  // Salvar cenário
  const salvarCenario = async () => {
    if (!cenarioSimulacao) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('simulacao_cenarios_preco')
      .insert({
        nome: cenarioSimulacao.nome || 'Cenário sem nome',
        descricao: cenarioSimulacao.descricao,
        criado_por: user?.id,
        tabela_base_id: cenarioSimulacao.tabela_base_id,
        tipo_markup: cenarioSimulacao.tipo_markup,
        valor_markup: cenarioSimulacao.valor_markup,
        origem: cenarioSimulacao.origem,
        produtos_ids: produtosSelecionados,
        resultados: resultados as any,
      });

    if (error) throw error;
  };

  // Exportar Excel
  const exportarExcel = async () => {
    if (resultados.length === 0) return;

    const dadosExport = resultados.map(r => ({
      codigo: r.produto_codigo,
      produto: r.produto_nome,
      categoria: r.categoria || '-',
      custo_base: r.custo_base,
      preco_atual: r.preco_atual,
      preco_simulado: r.preco_simulado,
      variacao_absoluta: r.variacao_absoluta,
      variacao_percentual: r.variacao_percentual.toFixed(2) + '%',
      margem_atual: r.margem_atual.toFixed(2) + '%',
      margem_simulada: r.margem_simulada.toFixed(2) + '%',
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const worksheet = workbook.addWorksheet('Simulação');
    worksheet.columns = [
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Produto', key: 'produto', width: 35 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Custo Base', key: 'custo_base', width: 12 },
      { header: 'Preço Atual', key: 'preco_atual', width: 12 },
      { header: 'Preço Simulado', key: 'preco_simulado', width: 14 },
      { header: 'Variação (R$)', key: 'variacao_absoluta', width: 12 },
      { header: 'Variação (%)', key: 'variacao_percentual', width: 12 },
      { header: 'Margem Atual', key: 'margem_atual', width: 12 },
      { header: 'Margem Simulada', key: 'margem_simulada', width: 14 },
    ];
    dadosExport.forEach(row => worksheet.addRow(row));
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const nomeArquivo = `simulacao_precos_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, nomeArquivo);
  };

  return {
    // State
    cenarioBase,
    setCenarioBase,
    cenarioSimulacao,
    setCenarioSimulacao,
    produtosSelecionados,
    setProdutosSelecionados,
    resultados,
    impactoCadeia,
    isLoading,
    
    // Data
    tabelas,
    produtos,
    
    // Actions
    recalcular,
    salvarCenario,
    exportarExcel,
  };
}
