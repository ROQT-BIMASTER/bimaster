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
  responsavel_id?: string | null;
  /** Série recorrente à qual o evento pertence (quando aplicável). */
  recorrencia_id?: string | null;
  projeto?: { id: string; nome: string; cor: string } | null;
  secao_nome?: string | null;
  /** Origem para roteamento de seleção. */
  origem?: "projeto" | "minhas-tarefas" | "calendario";
  /** Camada do Calendário Geral: tarefa de projeto ou evento avulso. */
  tipo?: "tarefa" | "evento";
  descricao?: string | null;
  hora_inicio?: string | null;          // HH:mm
  hora_fim?: string | null;             // HH:mm
  local?: string | null;
  /** Cor explícita (eventos avulsos). Prevalece sobre a cor do projeto. */
  cor?: string | null;
  categoria?: string | null;
  /** Marcadores livres (eventos avulsos). */
  tags?: string[];
}

import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";
import type { CalendarioEvento } from "@/hooks/useCalendarioEventos";


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
    responsavel_id: t.responsavel_id ?? null,
    recorrencia_id: (t as unknown as { recorrencia_id?: string | null }).recorrencia_id ?? null,
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
    responsavel_id: t.responsavel_id ?? null,
    projeto: { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor },
    secao_nome: t.secao_nome,
    origem: "minhas-tarefas",
    tipo: "tarefa",
  };
}

/** Converte um evento avulso do Calendário Geral no modelo unificado. */
export function eventoToCalendarEvent(e: CalendarioEvento): CalendarEvent {
  return {
    id: e.id,
    titulo: e.titulo,
    status: "evento",
    data_inicio: e.data_inicio,
    data_prazo: e.data_fim,
    descricao: e.descricao,
    hora_inicio: e.dia_inteiro ? null : (e.hora_inicio?.slice(0, 5) ?? null),
    hora_fim: e.dia_inteiro ? null : (e.hora_fim?.slice(0, 5) ?? null),
    local: e.local,
    cor: e.cor,
    categoria: e.categoria,
    recorrencia_id: e.recorrencia_id,
    origem: "calendario",
    tipo: "evento",
  };
}


export type ColorStrategy = "estagio" | "projeto";
