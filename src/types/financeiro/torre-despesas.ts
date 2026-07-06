// Payloads das RPCs da Torre de Controle de Despesas (Fase 1).
// Contrato 1:1 com fn_despesas_departamentos / fn_despesas_drill / fn_despesas_variacoes
// — ver docs/ARQUITETURA-TORRE-CONTROLE-DESPESAS.md §3/§5.

// ── fn_despesas_departamentos ────────────────────────────────────────────────

export interface TorreSeriePonto {
  /** YYYY-MM-DD (primeiro dia do mês) */
  mes: string;
  valor: number;
}

export interface TorreMeta {
  mes_ref: string; // YYYY-MM-DD
  meses: number;
}

export interface TorreQualidade {
  valor_sem_depto: number;
  pct_valor_sem_depto: number;
  pct_baixa_conf: number;
}

export interface TorreTotais {
  total_mes_ref: number;
  mom_pct: number | null;
  yoy_pct: number | null;
  serie: TorreSeriePonto[];
}

export interface TorreDepartamento {
  /** null = bucket "(sem classificação)" */
  departamento_id: string | null;
  departamento_nome: string;
  total_mes_ref: number;
  mom_pct: number | null;
  yoy_pct: number | null;
  /** (valor - avg12m)/stddev12m; null se n<6 meses ou stddev=0 */
  z_mes_ref: number | null;
  share_pct: number;
  media_12m: number;
  desvio_12m: number;
  /** ZERO-FILLED via generate_series (p_meses meses até mes_ref) */
  serie: TorreSeriePonto[];
}

export interface TorreDepartamentosPayload {
  meta: TorreMeta;
  qualidade: TorreQualidade;
  totais: TorreTotais;
  departamentos: TorreDepartamento[];
}

// ── fn_despesas_drill ────────────────────────────────────────────────────────

export type TorreDrillNivel = 'plano' | 'fornecedor' | 'titulos';

export interface TorreDrillPlanoItem {
  plano_contas_id: string | null;
  plano_nome: string;
  valor_mes: number;
  qtd: number;
  mom_pct: number | null;
  yoy_pct: number | null;
}

export interface TorreDrillFornecedorItem {
  fornecedor_codigo: string;
  fornecedor_nome: string;
  valor_mes: number;
  qtd: number;
  mom_pct: number | null;
  primeiro_lancamento: string; // YYYY-MM-DD
}

export interface TorreDrillTituloItem {
  id: string;
  erp_id: string;
  fornecedor_nome: string;
  valor_original: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  natureza_lancamento: string;
  numero_documento: string;
  parcela: number;
}

export interface TorreDrillPlanoPayload {
  itens: TorreDrillPlanoItem[];
  total_valor: number;
}

export interface TorreDrillFornecedorPayload {
  itens: TorreDrillFornecedorItem[];
  total_valor: number;
}

export interface TorreDrillTitulosPayload {
  itens: TorreDrillTituloItem[];
  total_qtd: number;
  total_valor: number;
}

export type TorreDrillPayload =
  | TorreDrillPlanoPayload
  | TorreDrillFornecedorPayload
  | TorreDrillTitulosPayload;

// ── fn_despesas_variacoes ────────────────────────────────────────────────────

export interface TorreVariacaoItem {
  departamento_id: string | null;
  departamento_nome: string;
  plano_contas_id: string | null;
  plano_nome: string;
  fornecedor_codigo: string;
  fornecedor_nome: string;
  valor_mes: number;
  mom_pct: number | null;
  yoy_pct: number | null;
  media_6m: number;
  z_6m: number | null;
  share_depto_pct: number;
  conta_ids: string[];
}

export interface TorreNovoFornecedorItem {
  fornecedor_codigo: string;
  fornecedor_nome: string;
  primeiro_lancamento: string; // YYYY-MM-DD
  valor_acumulado: number;
  qtd: number;
  conta_ids: string[];
}

export interface TorreDuplicidadeItem {
  fornecedor_codigo: string;
  fornecedor_nome: string;
  valor: number;
  datas: string[];
  erp_ids: string[];
  conta_ids: string[];
}

export interface TorreVariacoesPayload {
  mes_ref: string; // YYYY-MM-DD
  top_altas: TorreVariacaoItem[];
  top_quedas: TorreVariacaoItem[];
  novos_fornecedores: TorreNovoFornecedorItem[];
  duplicidades_mes: TorreDuplicidadeItem[];
}

// ── Filtros compartilhados da tela ───────────────────────────────────────────

export type TorreNatureza = 'provisionado' | 'lancado' | null;

export interface TorreFiltros {
  empresaIds: number[]; // [] = todas
  natureza: TorreNatureza;
  /** null = mês corrente (date_trunc no banco) */
  mesRef: string | null;
  /** null = mostrar tudo; 0.7 = ocultar classificação fraca */
  confMinima: number | null;
  /** [] = todos os centros de custo */
  centroCustoIds: string[];
}

export interface TorreCentroCustoDisponivel {
  id: string;
  codigo: string | null;
  nome: string;
  qtd: number;
  valor: number;
}

/** Seleção do heatmap que alimenta série + drill */
export interface TorreSelecao {
  /** null + semDepto=false => totais; null + semDepto=true => bucket sem classificação */
  departamentoId: string | null;
  semDepto: boolean;
  departamentoNome: string;
  /** YYYY-MM-DD */
  mes: string;
}
