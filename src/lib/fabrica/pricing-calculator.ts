import { supabase } from "@/integrations/supabase/client";

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
 * Busca os limites de preço de um produto
 */
export async function buscarLimitesProduto(produtoId: string): Promise<LimitePreco | null> {
  const { data, error } = await supabase
    .from('fabrica_produtos')
    .select('preco_maximo, preco_minimo')
    .eq('id', produtoId)
    .single();

  if (error || !data) return null;
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
    fonteCusto: 'ordem_producao' | 'manual' | 'custo_medio' | 'tabela_anterior' | 'custo_origem';
    custosManual?: Record<string, number>;
    origem?: 'nacional' | 'importado';
    aplicarLimites?: boolean; // Nova opção para aplicar limites
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
    const { data: produtos } = await supabase
      .from('fabrica_produtos')
      .select('id, preco_maximo, preco_minimo')
      .in('id', produtosIds);

    if (produtos) {
      limitesMap = produtos.reduce((acc, p) => {
        acc[p.id] = {
          preco_maximo: p.preco_maximo ? Number(p.preco_maximo) : null,
          preco_minimo: p.preco_minimo ? Number(p.preco_minimo) : null,
        };
        return acc;
      }, {} as Record<string, LimitePreco>);
    }
  }

  const resultados: PrecoProduto[] = [];

  for (const produtoId of produtosIds) {
    let custoBase = 0;

    // Determinar custo base
    if (opcoes.fonteCusto === 'manual' && opcoes.custosManual?.[produtoId]) {
      custoBase = opcoes.custosManual[produtoId];
    } else if (opcoes.fonteCusto === 'custo_origem' && opcoes.origem) {
      custoBase = (await buscarCustoOrigem(produtoId, opcoes.origem)) || 0;
    } else if (opcoes.fonteCusto === 'ordem_producao') {
      custoBase = (await buscarCustoUltimaOP(produtoId)) || 0;
    } else if (opcoes.fonteCusto === 'custo_medio') {
      custoBase = (await buscarCustoMedioProduto(produtoId)) || 0;
    } else if (opcoes.fonteCusto === 'tabela_anterior' && tabela.tabela_base_id) {
      custoBase = (await buscarPrecoTabelaBase(produtoId, tabela.tabela_base_id, opcoes.origem)) || 0;
    }

    // Calcular preço com markup
    const precoCalculado = calcularPrecoComMarkup(custoBase, {
      tipo: tabela.tipo_markup as MarkupConfig['tipo'],
      valor: tabela.valor_markup,
    });

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
