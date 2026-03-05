import { supabase } from "@/integrations/supabase/client";

// Interface para composição do custo da ficha de custos
export interface CustoComposicao {
  insumos: Array<{
    codigo: string;
    nome: string;
    tipo_insumo: string;
    custo_nf: number;
    custo_servico: number;
    custo_condicao: number;
  }>;
  mao_obra_nf: number;
  mao_obra_servico: number;
  markup_percentual: number;
  totais: {
    subtotal: number;
    markup: number;
    custo_total: number;
  };
}

export interface MarkupConfig {
  tipo: 'percentual' | 'multiplicador' | 'valor_fixo';
  valor: number;
}

export interface LimitePreco {
  preco_maximo?: number | null;
  preco_minimo?: number | null;
}

export interface PrecoProduto {
  produto_id: string;
  custo_base: number;
  preco_calculado: number;
  preco_final: number;
  margem_lucro_percentual: number;
  preco_limitado?: boolean;
  preco_original_calculado?: number;
  motivo_limite?: string;
  override_tipo?: 'linha' | 'produto' | null;
}

export interface MarkupOverride {
  id: string;
  tabela_id: string;
  linha: string | null;
  produto_id: string | null;
  tipo_markup: string;
  valor_markup: number;
  ativo: boolean;
}

/**
 * Calcula preço com markup percentual
 * Ex: custo 100, markup 35% → preço 135
 */
export function calcularPrecoPercentual(custo: number, percentual: number): number {
  if (custo <= 0) return 0;
  if (percentual < 0) return custo;
  return custo * (1 + percentual / 100);
}

/**
 * Calcula preço com multiplicador
 * Ex: custo 100, multiplicador 1.7 → preço 170
 */
export function calcularPrecoMultiplicador(custo: number, multiplicador: number): number {
  if (custo <= 0) return 0;
  if (multiplicador <= 0) return custo;
  return custo * multiplicador;
}

/**
 * Calcula preço com valor fixo adicionado
 * Ex: custo 100, fixo 50 → preço 150
 */
export function calcularPrecoValorFixo(custo: number, valorFixo: number): number {
  if (custo <= 0) return 0;
  return custo + valorFixo;
}

/**
 * Calcula preço baseado no tipo de markup
 */
export function calcularPrecoComMarkup(custo: number, config: MarkupConfig): number {
  switch (config.tipo) {
    case 'percentual':
      return calcularPrecoPercentual(custo, config.valor);
    case 'multiplicador':
      return calcularPrecoMultiplicador(custo, config.valor);
    case 'valor_fixo':
      return calcularPrecoValorFixo(custo, config.valor);
    default:
      return custo;
  }
}

/**
 * Calcula margem de lucro percentual
 * Ex: custo 100, preço 135 → margem 25.93%
 */
export function calcularMargemLucro(custo: number, preco: number): number {
  if (preco <= 0 || custo <= 0) return 0;
  return ((preco - custo) / preco) * 100;
}

/**
 * Busca o custo unitário da última ordem de produção de um produto
 */
export async function buscarCustoUltimaOP(produtoId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('fabrica_ordens_producao')
    .select(`
      quantidade_planejada,
      quantidade_produzida,
      fabrica_custos_producao(valor)
    `)
    .eq('produto_id', produtoId)
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Soma todos os custos da OP
  const custoTotal = (data.fabrica_custos_producao as any[])?.reduce(
    (acc, custo) => acc + (custo.valor || 0),
    0
  ) || 0;

  const quantidadeProduzida = data.quantidade_produzida || data.quantidade_planejada || 1;
  
  return custoTotal / quantidadeProduzida;
}

/**
 * Busca o custo médio atual de um produto
 */
export async function buscarCustoMedioProduto(produtoId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('fabrica_materias_primas')
    .select('custo_unitario')
    .eq('id', produtoId)
    .single();

  if (error || !data) return null;
  return data.custo_unitario;
}

/**
 * Busca o preço de um produto em uma tabela base
 */
export async function buscarPrecoTabelaBase(
  produtoId: string,
  tabelaBaseId: string,
  origem?: string
): Promise<number | null> {
  let query = supabase
    .from('fabrica_precos_produtos')
    .select('preco_final')
    .eq('tabela_id', tabelaBaseId)
    .eq('produto_id', produtoId)
    .eq('ativo', true);

  if (origem) {
    query = query.eq('origem', origem);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;
  return data.preco_final;
}

/**
 * Busca o custo de um produto por origem (nacional/importado)
 */
export async function buscarCustoOrigem(
  produtoId: string,
  origem: 'nacional' | 'importado'
): Promise<number | null> {
  const { data, error } = await supabase
    .from('fabrica_custos_origem')
    .select('custo_base')
    .eq('produto_id', produtoId)
    .eq('origem', origem)
    .eq('ativo', true)
    .order('data_referencia', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return Number(data.custo_base);
}

/**
 * Busca o custo da ficha de custos de um produto
 * Retorna o custo total calculado, a composição detalhada e o ID da config
 */
export async function buscarCustoFichaProduto(produtoId: string): Promise<{
  custoTotal: number;
  composicao: CustoComposicao | null;
  configId: string | null;
} | null> {
  // Buscar configuração da ficha de custo
  const { data: config, error: configError } = await supabase
    .from("fabrica_produto_custos_config")
    .select("*")
    .eq("produto_id", produtoId)
    .maybeSingle();

  if (configError || !config) return null;

  // Buscar insumos da ficha de custo
  const { data: insumos, error: insumosError } = await supabase
    .from("fabrica_produto_custos")
    .select("codigo, nome, fornecedor, tipo_insumo, custo_nf, custo_servico, custo_condicao")
    .eq("produto_id", produtoId)
    .order("ordem");

  if (insumosError) return null;

  // Calcular totais (mesma lógica do useFichaCustoProduto)
  const totalNFInsumos = insumos?.reduce((acc, i) => acc + (Number(i.custo_nf) || 0), 0) || 0;
  const totalServicoInsumos = insumos?.reduce((acc, i) => acc + (Number(i.custo_servico) || 0), 0) || 0;
  const totalCondicaoInsumos = insumos?.reduce((acc, i) => acc + (Number(i.custo_condicao) || 0), 0) || 0;

  // Adicionar M.O.
  const moNF = Number(config.custo_mao_obra_nf) || 0;
  const moServico = Number(config.custo_mao_obra_servico) || 0;

  const totalNF = totalNFInsumos + moNF;
  const totalServico = totalServicoInsumos + moServico;
  const totalCondicao = totalCondicaoInsumos;

  const subtotal = totalNF + totalServico + totalCondicao;

  // Markup
  const percentualMarkup = Number(config.percentual_markup) || 0;
  const markup = subtotal * (percentualMarkup / 100);
  const custoTotal = subtotal + markup;

  return {
    custoTotal,
    composicao: {
      insumos: (insumos || []).map(i => ({
        codigo: i.codigo || "",
        nome: i.nome || "",
        tipo_insumo: i.tipo_insumo || "outro",
        custo_nf: Number(i.custo_nf) || 0,
        custo_servico: Number(i.custo_servico) || 0,
        custo_condicao: Number(i.custo_condicao) || 0,
      })),
      mao_obra_nf: moNF,
      mao_obra_servico: moServico,
      markup_percentual: percentualMarkup,
      totais: { subtotal, markup, custo_total: custoTotal }
    },
    configId: config.id
  };
}

/**
 * Busca os limites de preço de um produto para uma tabela específica
 * Primeiro verifica limites específicos da tabela, depois cai para limites globais do produto
 */
export async function buscarLimitesProduto(
  produtoId: string, 
  tabelaId?: string
): Promise<LimitePreco | null> {
  // Se tabelaId fornecido, buscar limite específico da tabela
  if (tabelaId) {
    const { data: limiteTabela, error: erroTabela } = await supabase
      .from('fabrica_limites_preco_tabela')
      .select('preco_maximo, preco_minimo')
      .eq('produto_id', produtoId)
      .eq('tabela_id', tabelaId)
      .eq('ativo', true)
      .maybeSingle();

    if (!erroTabela && limiteTabela) {
      return {
        preco_maximo: limiteTabela.preco_maximo ? Number(limiteTabela.preco_maximo) : null,
        preco_minimo: limiteTabela.preco_minimo ? Number(limiteTabela.preco_minimo) : null,
      };
    }
  }

  // Fallback: buscar limite global do produto (se não houver específico da tabela)
  const { data, error } = await supabase
    .from('fabrica_produtos')
    .select('preco_maximo, preco_minimo')
    .eq('id', produtoId)
    .single();

  if (error || !data) return null;
  
  // Se ambos forem null, não há limite
  if (!data.preco_maximo && !data.preco_minimo) return null;
  
  return {
    preco_maximo: data.preco_maximo ? Number(data.preco_maximo) : null,
    preco_minimo: data.preco_minimo ? Number(data.preco_minimo) : null,
  };
}

/**
 * Aplica limites de preço (máximo e mínimo) e retorna informações sobre a limitação
 */
export function aplicarLimitesPreco(
  precoCalculado: number,
  limites: LimitePreco | null,
  custoBase: number
): { precoFinal: number; limitado: boolean; precoOriginal?: number; motivo?: string } {
  if (!limites) {
    return { precoFinal: precoCalculado, limitado: false };
  }

  let precoFinal = precoCalculado;
  let limitado = false;
  let motivo: string | undefined;

  // Verificar limite máximo
  if (limites.preco_maximo && precoCalculado > limites.preco_maximo) {
    precoFinal = limites.preco_maximo;
    limitado = true;
    motivo = `Preço ajustado de R$ ${precoCalculado.toFixed(2)} para R$ ${limites.preco_maximo.toFixed(2)} (limite máximo)`;
  }

  // Verificar limite mínimo (só aplica se não estiver limitado pelo máximo)
  if (!limitado && limites.preco_minimo && precoCalculado < limites.preco_minimo) {
    precoFinal = limites.preco_minimo;
    limitado = true;
    motivo = `Preço ajustado de R$ ${precoCalculado.toFixed(2)} para R$ ${limites.preco_minimo.toFixed(2)} (limite mínimo)`;
  }

  return {
    precoFinal,
    limitado,
    precoOriginal: limitado ? precoCalculado : undefined,
    motivo,
  };
}

/**
 * Calcula preços de produtos para uma tabela
 */
export async function calcularPrecosProdutos(
  tabelaId: string,
  produtosIds: string[],
  opcoes: {
    fonteCusto: 'ordem_producao' | 'manual' | 'custo_medio' | 'tabela_anterior' | 'custo_origem' | 'ficha_custo';
    custosManual?: Record<string, number>;
    origem?: 'nacional' | 'importado';
    aplicarLimites?: boolean; // Nova opção para aplicar limites
    custosFichaProduto?: Record<string, { custoTotal: number; composicao: CustoComposicao | null; configId: string | null }>;
  }
): Promise<PrecoProduto[]> {
  // Buscar configuração da tabela
  const { data: tabela, error: tabelaError } = await supabase
    .from('fabrica_tabelas_preco')
    .select('*')
    .eq('id', tabelaId)
    .single();

  if (tabelaError || !tabela) {
    throw new Error('Tabela de preço não encontrada');
  }

  // Buscar limites de todos os produtos de uma vez se necessário
  const aplicarLimites = opcoes.aplicarLimites !== false; // Por padrão, aplica limites
  let limitesMap: Record<string, LimitePreco> = {};

  if (aplicarLimites) {
    // Primeiro buscar limites específicos da tabela
    const { data: limitesTabela } = await supabase
      .from('fabrica_limites_preco_tabela')
      .select('produto_id, preco_maximo, preco_minimo')
      .eq('tabela_id', tabelaId)
      .eq('ativo', true)
      .in('produto_id', produtosIds);

    if (limitesTabela) {
      limitesTabela.forEach(l => {
        limitesMap[l.produto_id] = {
          preco_maximo: l.preco_maximo ? Number(l.preco_maximo) : null,
          preco_minimo: l.preco_minimo ? Number(l.preco_minimo) : null,
        };
      });
    }

    // Para produtos sem limite específico de tabela, buscar limites globais
    const produtosSemLimite = produtosIds.filter(id => !limitesMap[id]);
    if (produtosSemLimite.length > 0) {
      const { data: produtos } = await supabase
        .from('fabrica_produtos')
        .select('id, preco_maximo, preco_minimo')
        .in('id', produtosSemLimite);

      if (produtos) {
        produtos.forEach(p => {
          if (p.preco_maximo || p.preco_minimo) {
            limitesMap[p.id] = {
              preco_maximo: p.preco_maximo ? Number(p.preco_maximo) : null,
              preco_minimo: p.preco_minimo ? Number(p.preco_minimo) : null,
            };
          }
        });
      }
   }
  }

  // Buscar overrides de markup para esta tabela
  const { data: overrides } = await supabase
    .from('fabrica_markup_overrides')
    .select('*')
    .eq('tabela_id', tabelaId)
    .eq('ativo', true);

  // Buscar linhas dos produtos para matching de overrides por linha
  const { data: produtosInfo } = await supabase
    .from('fabrica_produtos')
    .select('id, linha')
    .in('id', produtosIds);

  const produtoLinhaMap: Record<string, string | null> = {};
  produtosInfo?.forEach(p => { produtoLinhaMap[p.id] = p.linha; });

  // Indexar overrides
  const overridesPorProduto: Record<string, MarkupOverride> = {};
  const overridesPorLinha: Record<string, MarkupOverride> = {};
  overrides?.forEach(o => {
    const ov = o as unknown as MarkupOverride;
    if (ov.produto_id) overridesPorProduto[ov.produto_id] = ov;
    if (ov.linha && !ov.produto_id) overridesPorLinha[ov.linha] = ov;
  });

  const resultados: PrecoProduto[] = [];

  for (const produtoId of produtosIds) {
    let custoBase = 0;

    // Determinar custo base
    if (opcoes.fonteCusto === 'manual' && opcoes.custosManual?.[produtoId]) {
      custoBase = opcoes.custosManual[produtoId];
    } else if (opcoes.fonteCusto === 'ficha_custo' && opcoes.custosFichaProduto?.[produtoId]) {
      custoBase = opcoes.custosFichaProduto[produtoId].custoTotal;
    } else if (opcoes.fonteCusto === 'ficha_custo') {
      const resultado = await buscarCustoFichaProduto(produtoId);
      custoBase = resultado?.custoTotal || 0;
    } else if (opcoes.fonteCusto === 'custo_origem' && opcoes.origem) {
      custoBase = (await buscarCustoOrigem(produtoId, opcoes.origem)) || 0;
    } else if (opcoes.fonteCusto === 'ordem_producao') {
      custoBase = (await buscarCustoUltimaOP(produtoId)) || 0;
    } else if (opcoes.fonteCusto === 'custo_medio') {
      custoBase = (await buscarCustoMedioProduto(produtoId)) || 0;
    } else if (opcoes.fonteCusto === 'tabela_anterior' && tabela.tabela_base_id) {
      custoBase = (await buscarPrecoTabelaBase(produtoId, tabela.tabela_base_id, opcoes.origem)) || 0;
    }

    // Determinar markup: override por produto > override por linha > markup da tabela
    let markupConfig: MarkupConfig = {
      tipo: tabela.tipo_markup as MarkupConfig['tipo'],
      valor: tabela.valor_markup,
    };
    let overrideTipo: 'linha' | 'produto' | null = null;

    if (overridesPorProduto[produtoId]) {
      const ov = overridesPorProduto[produtoId];
      markupConfig = { tipo: ov.tipo_markup as MarkupConfig['tipo'], valor: ov.valor_markup };
      overrideTipo = 'produto';
    } else {
      const linha = produtoLinhaMap[produtoId];
      if (linha && overridesPorLinha[linha]) {
        const ov = overridesPorLinha[linha];
        markupConfig = { tipo: ov.tipo_markup as MarkupConfig['tipo'], valor: ov.valor_markup };
        overrideTipo = 'linha';
      }
    }

    // Calcular preço com markup (override ou padrão)
    const precoCalculado = calcularPrecoComMarkup(custoBase, markupConfig);

    // Aplicar limites de preço se configurados
    const limites = limitesMap[produtoId] || null;
    const resultadoLimite = aplicarLimitesPreco(precoCalculado, limites, custoBase);

    const margemLucro = calcularMargemLucro(custoBase, resultadoLimite.precoFinal);

    resultados.push({
      produto_id: produtoId,
      custo_base: custoBase,
      preco_calculado: precoCalculado,
      preco_final: resultadoLimite.precoFinal,
      margem_lucro_percentual: margemLucro,
      preco_limitado: resultadoLimite.limitado,
      preco_original_calculado: resultadoLimite.precoOriginal,
      motivo_limite: resultadoLimite.motivo,
      override_tipo: overrideTipo,
    });
  }

  return resultados;
}

/**
 * Recalcula toda a cadeia de preços a partir de uma tabela
 */
export async function recalcularCadeiaPrecos(tabelaId: string): Promise<void> {
  // Buscar todas as tabelas que dependem desta
  const { data: tabelasDependentes, error } = await supabase
    .from('fabrica_tabelas_preco')
    .select('id, ordem')
    .eq('tabela_base_id', tabelaId)
    .order('ordem', { ascending: true });

  if (error || !tabelasDependentes) return;

  // Recalcular cada tabela dependente recursivamente
  for (const tabelaDependente of tabelasDependentes) {
    // Buscar produtos da tabela dependente
    const { data: precosProdutos } = await supabase
      .from('fabrica_precos_produtos')
      .select('produto_id')
      .eq('tabela_id', tabelaDependente.id)
      .eq('ativo', true);

    if (!precosProdutos) continue;

    const produtosIds = precosProdutos.map(p => p.produto_id);
    
    // Recalcular preços
    const novosPrecos = await calcularPrecosProdutos(
      tabelaDependente.id,
      produtosIds,
      { fonteCusto: 'tabela_anterior' }
    );

    // Atualizar preços no banco
    for (const preco of novosPrecos) {
      await supabase
        .from('fabrica_precos_produtos')
        .update({
          custo_base: preco.custo_base,
          preco_calculado: preco.preco_calculado,
          preco_final: preco.preco_final,
          margem_lucro_percentual: preco.margem_lucro_percentual,
          data_atualizacao: new Date().toISOString(),
        })
        .eq('tabela_id', tabelaDependente.id)
        .eq('produto_id', preco.produto_id);
    }

    // Recalcular dependentes desta tabela recursivamente
    await recalcularCadeiaPrecos(tabelaDependente.id);
  }
}

/**
 * Formata valor monetário para exibição
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Formata percentual para exibição
 */
export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

/**
 * Cálculo reverso: dado um preço desejado e custo base, calcula o markup necessário
 */
export function reverseMarkupPercentual(custo: number, precoDesejado: number): number {
  if (custo <= 0) return 0;
  return ((precoDesejado / custo) - 1) * 100;
}

export function reverseMarkupMultiplicador(custo: number, precoDesejado: number): number {
  if (custo <= 0) return 0;
  return precoDesejado / custo;
}

export function reverseMarkupValorFixo(custo: number, precoDesejado: number): number {
  return precoDesejado - custo;
}

export function reverseMarkup(
  custo: number,
  precoDesejado: number,
  tipoMarkup: 'percentual' | 'multiplicador' | 'valor_fixo'
): number {
  switch (tipoMarkup) {
    case 'percentual':
      return reverseMarkupPercentual(custo, precoDesejado);
    case 'multiplicador':
      return reverseMarkupMultiplicador(custo, precoDesejado);
    case 'valor_fixo':
      return reverseMarkupValorFixo(custo, precoDesejado);
    default:
      return 0;
  }
}

export function formatarMarkupLabel(valor: number, tipo: 'percentual' | 'multiplicador' | 'valor_fixo'): string {
  switch (tipo) {
    case 'percentual':
      return `+${valor.toFixed(2)}%`;
    case 'multiplicador':
      return `×${valor.toFixed(4)}`;
    case 'valor_fixo':
      return formatarMoeda(valor);
  }
}

/**
 * Interface para simulação de cálculo reverso
 */
export interface SimulacaoPrecoReverso {
  tabela_id: string;
  tabela_nome: string;
  preco_atual: number;
  preco_sugerido: number;
  diferenca_percentual: number;
  tipo_markup: string;
  valor_markup: number;
  margem_resultante: number;
}

/**
 * Calcula o preço reverso (de trás para frente) para atingir um preço final desejado
 * Dado um preço final desejado, calcula qual deveria ser o preço na tabela anterior
 */
export function calcularPrecoReversoMarkup(
  precoDesejado: number,
  tipoMarkup: 'percentual' | 'multiplicador' | 'valor_fixo',
  valorMarkup: number
): number {
  if (precoDesejado <= 0) return 0;

  switch (tipoMarkup) {
    case 'percentual':
      // precoFinal = precoBase * (1 + percentual/100)
      // precoBase = precoFinal / (1 + percentual/100)
      return precoDesejado / (1 + valorMarkup / 100);
    case 'multiplicador':
      // precoFinal = precoBase * multiplicador
      // precoBase = precoFinal / multiplicador
      return valorMarkup > 0 ? precoDesejado / valorMarkup : 0;
    case 'valor_fixo':
      // precoFinal = precoBase + valorFixo
      // precoBase = precoFinal - valorFixo
      return precoDesejado - valorMarkup;
    default:
      return precoDesejado;
  }
}

/**
 * Busca a cadeia de tabelas de preço entre a origem e o alvo
 * Retorna as tabelas em ordem, da origem ao alvo
 */
export async function buscarCadeiaTabelas(
  tabelaOrigemId: string,
  tabelaAlvoId: string
): Promise<Array<{
  id: string;
  nome: string;
  ordem: number;
  tipo_markup: string;
  valor_markup: number;
  tabela_base_id: string | null;
}>> {
  // Buscar todas as tabelas
  const { data: todasTabelas, error } = await supabase
    .from('fabrica_tabelas_preco')
    .select('id, nome, ordem, tipo_markup, valor_markup, tabela_base_id')
    .order('ordem', { ascending: true });

  if (error || !todasTabelas) return [];

  // Encontrar a cadeia de tabelas
  const cadeia: typeof todasTabelas = [];
  let tabelaAtual = todasTabelas.find(t => t.id === tabelaAlvoId);

  // Construir a cadeia de trás para frente
  while (tabelaAtual) {
    cadeia.unshift(tabelaAtual);
    if (tabelaAtual.id === tabelaOrigemId) break;
    tabelaAtual = todasTabelas.find(t => t.id === tabelaAtual?.tabela_base_id);
  }

  return cadeia;
}

/**
 * Simula o cálculo reverso para atingir um preço desejado
 * Calcula quais deveriam ser os preços em cada tabela da cadeia
 */
export async function simularCalculoReverso(
  tabelaAlvoId: string,
  tabelaOrigemId: string,
  produtoId: string,
  precoDesejado: number
): Promise<SimulacaoPrecoReverso[]> {
  // Buscar cadeia de tabelas
  const cadeia = await buscarCadeiaTabelas(tabelaOrigemId, tabelaAlvoId);
  if (cadeia.length === 0) return [];

  // Buscar preços atuais do produto em cada tabela da cadeia
  const tabelaIds = cadeia.map(t => t.id);
  const { data: precosAtuais } = await supabase
    .from('fabrica_precos_produtos')
    .select('tabela_id, preco_final, custo_base')
    .eq('produto_id', produtoId)
    .eq('ativo', true)
    .in('tabela_id', tabelaIds);

  const precosMap = new Map(precosAtuais?.map(p => [p.tabela_id, p]) || []);

  // Calcular preços sugeridos de trás para frente
  const simulacao: SimulacaoPrecoReverso[] = [];
  let precoAlvo = precoDesejado;

  // Percorrer a cadeia de trás para frente
  for (let i = cadeia.length - 1; i >= 0; i--) {
    const tabela = cadeia[i];
    const precoAtual = precosMap.get(tabela.id)?.preco_final || 0;
    const custoBase = precosMap.get(tabela.id)?.custo_base || 0;
    
    // Para a última tabela (alvo), o preço sugerido é o preço desejado
    // Para as demais, calcular o preço reverso baseado no markup da próxima tabela
    let precoSugerido: number;
    
    if (i === cadeia.length - 1) {
      precoSugerido = precoDesejado;
    } else {
      // O preço sugerido para esta tabela deve resultar no preço da próxima
      const proximaTabela = cadeia[i + 1];
      precoSugerido = calcularPrecoReversoMarkup(
        precoAlvo,
        proximaTabela.tipo_markup as 'percentual' | 'multiplicador' | 'valor_fixo',
        proximaTabela.valor_markup
      );
    }

    const diferencaPercentual = precoAtual > 0 
      ? ((precoSugerido - precoAtual) / precoAtual) * 100 
      : 0;

    // Calcular margem resultante baseada no custo base original
    const margemResultante = custoBase > 0 && precoSugerido > 0
      ? ((precoSugerido - custoBase) / precoSugerido) * 100
      : 0;

    simulacao.unshift({
      tabela_id: tabela.id,
      tabela_nome: tabela.nome,
      preco_atual: precoAtual,
      preco_sugerido: precoSugerido,
      diferenca_percentual: diferencaPercentual,
      tipo_markup: tabela.tipo_markup,
      valor_markup: tabela.valor_markup,
      margem_resultante: margemResultante,
    });

    precoAlvo = precoSugerido;
  }

  return simulacao;
}
