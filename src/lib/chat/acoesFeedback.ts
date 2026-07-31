/**
 * Mensagens padronizadas de feedback (toasts) para as ações de
 * "Enviar para aprovação" e "Chamar atenção".
 *
 * Padrão único em todo o sistema:
 *   - Sucesso: toast.success(TÍTULO, { description })
 *   - Falha:   toast.error(TÍTULO, { description })
 *   - Validação: toast.error(TÍTULO, { description })
 *
 * Títulos são curtos e sem pontuação final; descrições explicam o próximo
 * passo ou a causa. Nenhum componente deve montar strings próprias — sempre
 * importar os helpers abaixo para manter paridade entre painéis.
 */
import { toast } from "sonner";

export type AcaoChat = "aprovacao" | "urgente";
export type EscopoAcao = "briefing" | "projeto" | "submissao" | "tarefa" | "processo" | "conversa";

const ACAO_NOME: Record<AcaoChat, string> = {
  aprovacao: "aprovação",
  urgente: "chamada de atenção",
};

const ESCOPO_NOME: Record<EscopoAcao, string> = {
  briefing: "briefing",
  projeto: "projeto",
  submissao: "submissão",
  tarefa: "tarefa",
  processo: "processo",
  conversa: "conversa",
};

const FALHA_GENERICA = "Tente novamente em instantes.";

export function nomeAcao(acao: AcaoChat) {
  return ACAO_NOME[acao];
}

export function nomeEscopo(escopo: EscopoAcao) {
  return ESCOPO_NOME[escopo] ?? "item";
}

export function motivoErro(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message?.trim();
  return msg && msg.length > 0 ? msg : FALHA_GENERICA;
}

/** Ação vinculada iniciada: o chat correspondente será aberto. */
export function toastAcaoIniciada(acao: AcaoChat, escopo: EscopoAcao) {
  toast.success(
    acao === "aprovacao" ? "Aprovação iniciada" : "Chamada de atenção iniciada",
    { description: `Abrindo o chat vinculado ${escopo === "submissao" ? "à" : "ao"} ${nomeEscopo(escopo)}.` },
  );
}

/** Falha ao abrir/iniciar a ação vinculada. */
export function toastAcaoFalhou(acao: AcaoChat, e: unknown) {
  toast.error(
    acao === "aprovacao"
      ? "Não foi possível iniciar a aprovação"
      : "Não foi possível iniciar a chamada de atenção",
    { description: motivoErro(e) },
  );
}

/** Ação concluída (solicitação criada / mensagem urgente enviada). */
export function toastAcaoConcluida(acao: AcaoChat, description?: string) {
  toast.success(
    acao === "aprovacao" ? "Aprovação solicitada" : "Chamada de atenção enviada",
    {
      description:
        description ??
        (acao === "aprovacao"
          ? "Os participantes da conversa foram notificados."
          : "Os participantes da conversa foram notificados."),
    },
  );
}

/** Falha ao concluir a ação (envio/criação). */
export function toastAcaoEnvioFalhou(acao: AcaoChat, e: unknown) {
  toast.error(
    acao === "aprovacao"
      ? "Não foi possível solicitar a aprovação"
      : "Não foi possível enviar a chamada de atenção",
    { description: motivoErro(e) },
  );
}

/** Validação de formulário antes do envio. */
export function toastAcaoValidacao(acao: AcaoChat, description: string) {
  toast.error(
    acao === "aprovacao"
      ? "Revise a solicitação de aprovação"
      : "Revise a chamada de atenção",
    { description },
  );
}
