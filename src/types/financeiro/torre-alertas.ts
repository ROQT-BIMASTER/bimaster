// Tipos da fila de alertas da Torre (Fase 2). Espelham public.despesa_alertas
// (migration 20260705152442) + o retorno das RPCs fn_despesas_alerta_transicao /
// rpc_torre_reprocessar_deteccao.

export type AlertaSeveridade = 'critica' | 'alta' | 'media' | 'baixa';
export type AlertaStatus = 'novo' | 'em_analise' | 'acionado' | 'resolvido' | 'descartado';

export interface DespesaAlerta {
  id: string;
  regra_codigo: string;
  chave_dedup: string;
  severidade: AlertaSeveridade;
  status: AlertaStatus;
  origem: string;
  titulo: string;
  descricao: string | null;
  score: number | null;
  valor_impacto: number | null;
  empresa_id: number | null;
  departamento_id: string | null;
  plano_contas_id: string | null;
  centro_custo_id: string | null;
  fornecedor_codigo: string | null;
  fornecedor_nome: string | null;
  competencia: string | null; // YYYY-MM-DD
  conta_ids: string[] | null;
  evidencia: Record<string, unknown>;
  primeiro_detectado_em: string;
  ultimo_detectado_em: string;
  ocorrencias: number;
  reaberto_count: number;
  revisao_id: string | null;
  atribuido_a: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  resolucao_nota: string | null;
  created_at: string;
  updated_at: string;
}

/** Retorno de rpc_torre_reprocessar_deteccao / fn_despesa_detectar */
export interface DeteccaoResultado {
  regra: string;
  inseridos: number;
  atualizados: number;
}

/** Agrupamento das abas da fila (encerrados = resolvido + descartado) */
export type AlertaAba = 'novo' | 'em_analise' | 'acionado' | 'encerrado';

export const ABAS_STATUS: Record<AlertaAba, AlertaStatus[]> = {
  novo: ['novo'],
  em_analise: ['em_analise'],
  acionado: ['acionado'],
  encerrado: ['resolvido', 'descartado'],
};

export const SEVERIDADE_ORDEM: Record<AlertaSeveridade, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};
