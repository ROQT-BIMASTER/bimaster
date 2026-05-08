/**
 * Catálogo de status para Ordens de Produção da China.
 * Compartilhado entre página, drawer e exportações.
 */
export type OPStatus =
  | "pendente"
  | "em_andamento"
  | "pausada"
  | "concluida"
  | "cancelada";

export interface OPStatusInfo {
  pt: string;
  cn: string;
  variant: "default" | "secondary" | "success" | "destructive" | "warning";
  bar: string;
}

export const OP_STATUS: Record<string, OPStatusInfo> = {
  pendente: { pt: "Pendente", cn: "待处理", variant: "secondary", bar: "border-l-muted-foreground/40" },
  em_andamento: { pt: "Em Produção", cn: "生产中", variant: "warning", bar: "border-l-warning" },
  pausada: { pt: "Pausada", cn: "已暂停", variant: "secondary", bar: "border-l-muted-foreground/40" },
  concluida: { pt: "Concluída", cn: "已完成", variant: "success", bar: "border-l-success" },
  cancelada: { pt: "Cancelada", cn: "已取消", variant: "destructive", bar: "border-l-destructive" },
};

export function getOPStatusInfo(status?: string | null): OPStatusInfo {
  return OP_STATUS[status || ""] || OP_STATUS.pendente;
}
