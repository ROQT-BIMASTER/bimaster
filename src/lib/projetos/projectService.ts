import { supabase } from "@/integrations/supabase/client";

/**
 * Serviço único para criar/sincronizar Projetos a partir de Submissões China.
 *
 * Status: Fase 1 (PR-2 do plano de unificação Submissão↔Projeto).
 *
 * Esta camada é a futura "fonte única de verdade" para a criação de projeto
 * a partir de uma submissão. Nesta fase ela apenas DELEGA aos caminhos
 * existentes (`rpc_china_criar_projeto_espelho` e o fluxo legado da Ficha do
 * Produto), preservando 100% de compatibilidade. As fases seguintes vão:
 *
 *  - Fase 2: trigger bidirecional checklist ↔ tarefas
 *  - Fase 3: foto oficial da submissão
 *  - Fase 4: modal unificado + feature flag
 *  - Fase 5: backfill de duplicatas
 *  - Fase 6: UNIQUE(submissao_id) + remoção do código legado
 *
 * Regra de ouro: NUNCA escrever em `china_submissao_projetos` sem antes
 * chamar `findBySubmission` para garantir idempotência.
 */

export interface SubmissionLink {
  projeto_id: string;
  submissao_id: string;
  is_espelho: boolean;
}

export const ProjectService = {
  /**
   * Retorna o projeto-espelho da submissão se existir, senão o primeiro
   * vínculo qualquer. Use isto antes de qualquer create para evitar
   * duplicação.
   */
  async findBySubmission(submissaoId: string): Promise<SubmissionLink | null> {
    if (!submissaoId) return null;

    // Prefere o espelho oficial
    const espelho = await supabase
      .from("china_submissao_projetos")
      .select("projeto_id, submissao_id, is_espelho")
      .eq("submissao_id", submissaoId)
      .eq("is_espelho", true)
      .maybeSingle();
    if (espelho.error) throw espelho.error;
    if (espelho.data) return espelho.data as SubmissionLink;

    // Fallback: qualquer vínculo (projetos criados pelo fluxo legado da Ficha)
    const any = await supabase
      .from("china_submissao_projetos")
      .select("projeto_id, submissao_id, is_espelho")
      .eq("submissao_id", submissaoId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (any.error) throw any.error;
    return (any.data as SubmissionLink | null) ?? null;
  },

  /**
   * Cria ou recupera o projeto da submissão via RPC unificada
   * (`rpc_china_criar_projeto_espelho`). Idempotente: chamadas concorrentes
   * convergem para o mesmo projeto.
   */
  async createFromSubmission(
    submissaoId: string,
    opts: {
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
    } = {},
  ): Promise<{
    projeto_id: string;
    submissao_id: string;
    secao_id?: string;
    created: boolean;
    already_existed: boolean;
  }> {
    if (!submissaoId) throw new Error("submissaoId é obrigatório");

    const { data, error } = await supabase.rpc(
      "rpc_china_criar_projeto_espelho" as any,
      {
        p_submissao_id: submissaoId,
        p_projeto_id: null,
        p_template_b2c_id: opts.templateB2cId ?? null,
        p_secao_nome: opts.secaoNome ?? "Documentos da Submissão",
        p_projeto_nome: opts.projetoNome ?? null,
        p_data_inicio: opts.dataInicio ?? null,
        p_data_fim_alvo: opts.dataFimAlvo ?? null,
        p_prazo_padrao_tarefa: opts.prazoPadraoTarefa ?? null,
        p_alerta_antecipacao_dias: opts.alertaAntecipacaoDias ?? null,
        p_regime_calendario: opts.regimeCalendario ?? null,
        p_usa_feriados: opts.usaFeriados ?? null,
        p_uf_feriados: opts.ufFeriados ?? null,
        p_substituir: opts.substituir ?? false,
      },
    );
    if (error) throw error;
    return data as any;
  },

  /**
   * Vincula a submissão a um projeto JÁ existente. Idempotente.
   * Aceita os mesmos opts de `createFromSubmission` para casos em que o
   * caller quer também ajustar template/datas/calendário no vínculo.
   */
  async linkExisting(
    submissaoId: string,
    projetoId: string,
    opts: {
      templateB2cId?: string | null;
      secaoNome?: string;
      projetoNome?: string | null;
      dataInicio?: string | null;
      dataFimAlvo?: string | null;
      prazoPadraoTarefa?: number | null;
      alertaAntecipacaoDias?: number | null;
      regimeCalendario?: "corridos" | "dias_uteis" | "uteis_com_sabado" | null;
      usaFeriados?: boolean | null;
      ufFeriados?: string | null;
      substituir?: boolean;
    } = {},
  ) {
    const { data, error } = await supabase.rpc(
      "rpc_china_criar_projeto_espelho" as any,
      {
        p_submissao_id: submissaoId,
        p_projeto_id: projetoId,
        p_template_b2c_id: opts.templateB2cId ?? null,
        p_secao_nome: opts.secaoNome ?? "Documentos da Submissão",
        p_projeto_nome: opts.projetoNome ?? null,
        p_data_inicio: opts.dataInicio ?? null,
        p_data_fim_alvo: opts.dataFimAlvo ?? null,
        p_prazo_padrao_tarefa: opts.prazoPadraoTarefa ?? null,
        p_alerta_antecipacao_dias: opts.alertaAntecipacaoDias ?? null,
        p_regime_calendario: opts.regimeCalendario ?? null,
        p_usa_feriados: opts.usaFeriados ?? null,
        p_uf_feriados: opts.ufFeriados ?? null,
        p_substituir: opts.substituir ?? false,
      },
    );
    if (error) throw error;
    return data as any;
  },
};

