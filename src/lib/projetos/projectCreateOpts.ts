/**
 * Forma única dos parâmetros de criação/vinculação de projeto a partir
 * de uma submissão China. Compartilhado entre `ProjectService`, os hooks
 * `useCriarProjetoEspelho` (Fluxo 2) e qualquer caller futuro do
 * `rpc_china_criar_projeto_espelho`.
 *
 * NÃO mude a forma sem garantir que todos os consumers sigam — qualquer
 * divergência reintroduz duplicidade de entrypoint.
 */
import type { ProjetoConversaoEstruturaCategoria } from "@/lib/china/buildConversaoEstrutura";

export interface ProjectCreateOpts {
  projetoNome?: string | null;
  templateB2cId?: string | null;
  secaoNome?: string;
  dataInicio?: string | null;
  dataFimAlvo?: string | null;
  prazoPadraoTarefa?: number | null;
  alertaAntecipacaoDias?: number | null;
  regimeCalendario?: "corridos" | "dias_uteis" | "uteis_com_sabado" | null;
  usaFeriados?: boolean | null;
  ufFeriados?: string | null;
  substituir?: boolean;
  /**
   * Estrutura hierárquica categorias→itens do checklist da submissão.
   * Quando informada, a RPC cria 1 Seção por categoria e 1 Tarefa por item.
   * Quando ausente/`null`, a RPC cai no comportamento legado (única seção).
   */
  estrutura?: ProjetoConversaoEstruturaCategoria[] | null;
}

/** Defaults aplicados antes de chamar o RPC — fonte única de verdade. */
export const DEFAULT_SECAO_NOME = "Documentos da Submissão";

/**
 * Normaliza um `ProjectCreateOpts` parcial nos parâmetros nomeados que o
 * RPC `rpc_china_criar_projeto_espelho` espera. Mantém os defaults atuais
 * em produção (todos `null` salvo `p_secao_nome` e `p_substituir=false`).
 */
export function buildRpcParams(
  submissaoId: string,
  projetoId: string | null,
  opts: ProjectCreateOpts = {},
) {
  return {
    p_submissao_id: submissaoId,
    p_projeto_id: projetoId,
    p_template_b2c_id: opts.templateB2cId ?? null,
    p_secao_nome: opts.secaoNome ?? DEFAULT_SECAO_NOME,
    p_projeto_nome: opts.projetoNome ?? null,
    p_data_inicio: opts.dataInicio ?? null,
    p_data_fim_alvo: opts.dataFimAlvo ?? null,
    p_prazo_padrao_tarefa: opts.prazoPadraoTarefa ?? null,
    p_alerta_antecipacao_dias: opts.alertaAntecipacaoDias ?? null,
    p_regime_calendario: opts.regimeCalendario ?? null,
    p_usa_feriados: opts.usaFeriados ?? null,
    p_uf_feriados: opts.ufFeriados ?? null,
    p_substituir: opts.substituir ?? false,
    p_estrutura: opts.estrutura ?? null,
  };
}
