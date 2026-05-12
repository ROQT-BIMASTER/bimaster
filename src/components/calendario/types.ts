/**
 * Modelo unificado de evento para o calendário compartilhado entre
 * Projetos (ProjetoCalendarioView) e Central de Trabalho (MinhasTarefasCalendar).
 *
 * Mantém somente o necessário para renderizar a célula/barra/popover.
 * Cada origem deve mapear seu shape para CalendarEvent via adapters.
 */
export interface CalendarEvent {
  id: string;
  titulo: string;
  status: string;                       // pendente | em_andamento | concluida | bloqueada
  prioridade?: string | null;
  estagio?: string | null;              // usado em Projetos para cor da borda
  data_inicio?: string | null;          // ISO date (Y-M-D)
  data_prazo?: string | null;           // ISO date (Y-M-D)
  responsavel?: { nome: string; avatar_url?: string | null } | null;
  projeto?: { id: string; nome: string; cor: string } | null;
  secao_nome?: string | null;
  /** Origem para roteamento de seleção. */
  origem?: "projeto" | "minhas-tarefas";
}

import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

export function tarefaToEvent(t: ProjetoTarefa, projeto?: { id: string; nome: string; cor: string } | null): CalendarEvent {
  return {
    id: t.id,
    titulo: t.titulo,
    status: t.status,
    prioridade: t.prioridade,
    estagio: t.estagio,
    data_inicio: t.data_inicio_planejada ?? null,
    data_prazo: t.data_prazo,
    responsavel: t.responsavel ? { nome: t.responsavel.nome, avatar_url: t.responsavel.avatar_url } : null,
    projeto: projeto ?? null,
    origem: "projeto",
  };
}

export function minaTarefaToEvent(t: MinaTarefa): CalendarEvent {
  return {
    id: t.id,
    titulo: t.titulo,
    status: t.status,
    prioridade: t.prioridade,
    estagio: t.estagio,
    data_inicio: t.data_inicio_planejada,
    data_prazo: t.data_prazo,
    responsavel: t.responsavel_nome
      ? { nome: t.responsavel_nome, avatar_url: t.responsavel_avatar_url }
      : null,
    projeto: { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor },
    secao_nome: t.secao_nome,
    origem: "minhas-tarefas",
  };
}

export type ColorStrategy = "estagio" | "projeto";
