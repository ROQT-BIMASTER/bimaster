import { useQuery } from "@tanstack/react-query";
import {
  listarAcoesAuditoria,
  type AcaoEntidadeTipo,
  type AcaoAuditoriaRow,
} from "@/lib/chat/acoesAuditoria";

/**
 * Histórico auditado das ações de aprovação e chamada de atenção de uma
 * entidade (tarefa, prospect, projeto, briefing, submissão, processo).
 */
export function useChatAcoesAuditoria(
  entidadeTipo: AcaoEntidadeTipo,
  entidadeId?: string | null,
  limit = 100,
) {
  return useQuery<AcaoAuditoriaRow[]>({
    queryKey: ["chat-acoes-auditoria", entidadeTipo, entidadeId, limit],
    enabled: !!entidadeId,
    queryFn: () => listarAcoesAuditoria(entidadeTipo, entidadeId as string, limit),
    staleTime: 30_000,
  });
}
