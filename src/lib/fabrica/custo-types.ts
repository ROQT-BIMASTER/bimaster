// Tipos para o sistema de Ficha Técnica de Custos

export interface FichaCustoConfig {
  id?: string;
  formula_id: string;
  custo_mao_obra: number;
  fornecedor_mao_obra: string;
  percentual_markup: number;
  custo_mao_obra_nf: number;
  custo_mao_obra_servico: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustoItem {
  id: string;
  codigo?: string;
  nome: string;
  fornecedor?: string;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  nf_referencia?: string;
  tipo_insumo?: TipoInsumo;
  quantidade: number;
  unidade?: string;
}

export type TipoInsumo = 
  | 'bulk'
  | 'embalagem_primaria'
  | 'embalagem_secundaria'
  | 'rotulos_impressos'
  | 'embalagem_terciaria'
  | 'consumiveis'
  | 'acessorios';

export const TIPOS_INSUMO: { value: TipoInsumo; label: string }[] = [
  { value: 'bulk', label: 'Bulk/Granel' },
  { value: 'embalagem_primaria', label: 'Embalagem Primária' },
  { value: 'embalagem_secundaria', label: 'Embalagem Secundária' },
  { value: 'rotulos_impressos', label: 'Rótulos/Impressos' },
  { value: 'embalagem_terciaria', label: 'Embalagem Terciária' },
  { value: 'consumiveis', label: 'Consumíveis' },
  { value: 'acessorios', label: 'Acessórios' },
];

export interface CustosTotais {
  custoNfTotal: number;
  custoServicoTotal: number;
  custoCondicaoTotal: number;
  custoMaoObra: number;
  markup: number;
  markupValor: number;
  custoFinalTotal: number;
}

export function calcularCustosTotais(
  itens: CustoItem[],
  config: FichaCustoConfig
): CustosTotais {
  const custoNfTotal = itens.reduce((sum, item) => sum + (item.custo_nf || 0), 0);
  const custoServicoTotal = itens.reduce((sum, item) => sum + (item.custo_servico || 0), 0);
  const custoCondicaoTotal = itens.reduce((sum, item) => sum + (item.custo_condicao || 0), 0);
  
  const custoMaoObra = (config.custo_mao_obra_nf || 0) + (config.custo_mao_obra_servico || 0);
  
  const subtotal = custoNfTotal + custoServicoTotal + custoCondicaoTotal + custoMaoObra;
  const markup = config.percentual_markup || 10;
  const markupValor = subtotal * (markup / 100);
  
  const custoFinalTotal = subtotal + markupValor;

  return {
    custoNfTotal,
    custoServicoTotal,
    custoCondicaoTotal,
    custoMaoObra,
    markup,
    markupValor,
    custoFinalTotal,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

export function getTipoInsumoLabel(tipo?: TipoInsumo): string {
  if (!tipo) return '-';
  const found = TIPOS_INSUMO.find(t => t.value === tipo);
  return found?.label || tipo;
}
