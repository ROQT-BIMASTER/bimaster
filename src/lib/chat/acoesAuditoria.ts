/**
 * Auditoria das ações de chat: "Enviar para aprovação" e "Chamar atenção".
 *
 * Todo disparo (início, conclusão e falha) é gravado em
 * `chat_acoes_auditoria` via RPC `rpc_registrar_acao_chat_auditoria`,
 * ficando disponível no histórico da entidade de origem (tarefa, projeto,
 * prospect, briefing, submissão, processo ou a própria conversa).
 *
 * A auditoria nunca pode quebrar o fluxo do usuário: falhas de registro são
 * apenas logadas no console.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AcaoChat } from "./acoesFeedback";

export type AcaoFase = "iniciada" | "concluida" | "falhou";

export type AcaoEntidadeTipo =
  | "briefing"
  | "projeto"
  | "submissao"
  | "tarefa"
  | "processo"
  | "prospect"
  | "conversa";

export interface RegistroAcaoChat {
  acao: AcaoChat;
  fase: AcaoFase;
  entidadeTipo: AcaoEntidadeTipo;
  entidadeId?: string | null;
  conversaId?: string | null;
  referenciaId?: string | null;
  detalhe?: string | null;
  erro?: unknown;
  metadata?: Record<string, unknown>;
}

function mensagemErro(e: unknown): string | null {
  if (!e) return null;
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message;
  return m ?? null;
}

/** Grava um evento de auditoria. Nunca lança. */
export async function registrarAcaoChat(r: RegistroAcaoChat): Promise<string | null> {
  try {
    const { data, error } = await (supabase.rpc as any)("rpc_registrar_acao_chat_auditoria", {
      p_acao: r.acao,
      p_fase: r.fase,
      p_entidade_tipo: r.entidadeTipo,
      p_entidade_id: r.entidadeId ?? null,
      p_conversa_id: r.conversaId ?? null,
      p_referencia_id: r.referenciaId ?? null,
      p_detalhe: r.detalhe ?? null,
      p_erro: mensagemErro(r.erro),
      p_metadata: r.metadata ?? {},
    });
    if (error) throw error;
    return (data as string) ?? null;
  } catch (e) {
    console.warn("[auditoria] falha ao registrar ação de chat", e);
    return null;
  }
}

export interface AcaoAuditoriaRow {
  id: string;
  acao: AcaoChat;
  fase: AcaoFase;
  entidade_tipo: AcaoEntidadeTipo;
  entidade_id: string | null;
  conversa_id: string | null;
  referencia_id: string | null;
  detalhe: string | null;
  erro: string | null;
  metadata: Record<string, unknown> | null;
  user_id: string;
  user_nome: string | null;
  created_at: string;
}

/** Lê o histórico auditado de uma entidade (tarefa, prospect, projeto...). */
export async function listarAcoesAuditoria(
  entidadeTipo: AcaoEntidadeTipo,
  entidadeId: string,
  limit = 100,
): Promise<AcaoAuditoriaRow[]> {
  const { data, error } = await (supabase.rpc as any)("rpc_chat_acoes_auditoria_historico", {
    p_entidade_tipo: entidadeTipo,
    p_entidade_id: entidadeId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as AcaoAuditoriaRow[];
}
