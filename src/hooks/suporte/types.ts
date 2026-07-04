// Tipos locais do módulo Suporte v2 (help desk multi-departamento).
// As tabelas suporte_filas/suporte_fila_agentes ainda não estão em
// integrations/supabase/types.ts (tipos gerados) — usamos interfaces
// locais + cast `as any` nas queries, como em SuporteAdmin.tsx.

export interface SuporteFila {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  ativo: boolean;
  aceita_chamados: boolean;
  ordem: number;
  projeto_id?: string | null;
  auto_criar_tarefa?: boolean;
}

export interface SuporteFilaAgente {
  fila_id: string;
  user_id: string;
  papel: "agente" | "lider";
  ativo: boolean;
}

export type SuporteTicketStatus =
  | "novo"
  | "em_triagem"
  | "em_atendimento"
  | "aguardando_usuario"
  | "escalado"
  | "resolvido";

export type SuportePrioridade = "baixa" | "media" | "alta" | "critica";

export interface SuporteChamado {
  id: string;
  conversa_id: string;
  owner_id: string;
  requester_id: string | null;
  fila_id: string | null;
  assignee_id: string | null;
  canal: string;
  status: SuporteTicketStatus;
  prioridade: SuportePrioridade;
  categoria: string | null;
  titulo: string | null;
  resumo: string | null;
  protocolo: string | null;
  sla_status: string | null;
  prazo_primeira_resposta_em: string | null;
  primeira_resposta_em: string | null;
  prazo_resolucao_em: string | null;
  ultima_interacao_em: string | null;
  resolved_at: string | null;
  reaberto_em: string | null;
  escalado_em: string | null;
  sla_pausado_em: string | null;
  sentimento: string | null;
  tags: string[] | null;
  created_at: string;
  // enriquecidos no client
  fila?: SuporteFila | null;
  requester?: { id: string; nome: string | null; avatar_url: string | null } | null;
}

export const SUPORTE_STATUS_LABEL: Record<SuporteTicketStatus, string> = {
  novo: "Novo",
  em_triagem: "Em triagem",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  escalado: "Escalado",
  resolvido: "Resolvido",
};

export const SUPORTE_STATUS_COLOR: Record<SuporteTicketStatus, string> = {
  novo: "bg-blue-500",
  em_triagem: "bg-violet-500",
  em_atendimento: "bg-yellow-500",
  aguardando_usuario: "bg-orange-500",
  escalado: "bg-red-500",
  resolvido: "bg-green-500",
};

export const SUPORTE_PRIORIDADE_LABEL: Record<SuportePrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const SUPORTE_PRIORIDADE_CLASS: Record<SuportePrioridade, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  alta: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  critica: "bg-red-500/10 text-red-700 border-red-500/20",
};
