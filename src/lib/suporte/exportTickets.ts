import type { SuporteChamado } from "@/hooks/suporte/types";
import { SUPORTE_PRIORIDADE_LABEL, SUPORTE_STATUS_LABEL } from "@/hooks/suporte/types";
import { format } from "date-fns";

export type TicketColuna =
  | "protocolo"
  | "titulo"
  | "solicitante"
  | "fila"
  | "responsavel"
  | "status"
  | "prioridade"
  | "sla"
  | "categoria"
  | "canal"
  | "criado_em"
  | "atualizado_em"
  | "tags";

export const COLUNA_LABEL: Record<TicketColuna, string> = {
  protocolo: "Protocolo",
  titulo: "Título",
  solicitante: "Solicitante",
  fila: "Departamento",
  responsavel: "Responsável",
  status: "Status",
  prioridade: "Prioridade",
  sla: "SLA",
  categoria: "Categoria",
  canal: "Canal",
  criado_em: "Criado em",
  atualizado_em: "Atualizado em",
  tags: "Tags",
};

export const COLUNAS_DEFAULT: TicketColuna[] = [
  "protocolo",
  "titulo",
  "solicitante",
  "fila",
  "responsavel",
  "status",
  "prioridade",
  "sla",
  "atualizado_em",
];

export const TODAS_COLUNAS: TicketColuna[] = [
  "protocolo",
  "titulo",
  "solicitante",
  "fila",
  "responsavel",
  "status",
  "prioridade",
  "sla",
  "categoria",
  "canal",
  "criado_em",
  "atualizado_em",
  "tags",
];

function valorPorColuna(t: SuporteChamado, col: TicketColuna, nomes: Map<string, string>): string {
  switch (col) {
    case "protocolo": return t.protocolo ?? "";
    case "titulo": return t.titulo ?? "";
    case "solicitante": return t.requester?.nome ?? "";
    case "fila": return t.fila?.nome ?? "";
    case "responsavel": return t.assignee_id ? (nomes.get(t.assignee_id) ?? "—") : "";
    case "status": return SUPORTE_STATUS_LABEL[t.status] ?? t.status;
    case "prioridade": return SUPORTE_PRIORIDADE_LABEL[t.prioridade] ?? t.prioridade;
    case "sla": return t.sla_status ?? "";
    case "categoria": return t.categoria ?? "";
    case "canal": return t.canal;
    case "criado_em": return format(new Date(t.created_at), "yyyy-MM-dd HH:mm");
    case "atualizado_em": return t.ultima_interacao_em
      ? format(new Date(t.ultima_interacao_em), "yyyy-MM-dd HH:mm")
      : "";
    case "tags": return (t.tags ?? []).join(", ");
  }
}

function escapeCsv(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportTicketsCsv(tickets: SuporteChamado[], colunas: TicketColuna[], nomes: Map<string, string>): Blob {
  const header = colunas.map((c) => COLUNA_LABEL[c]).join(";");
  const rows = tickets.map((t) =>
    colunas.map((c) => escapeCsv(valorPorColuna(t, c, nomes))).join(";"),
  );
  const csv = "\ufeff" + [header, ...rows].join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

export async function exportTicketsXlsx(
  tickets: SuporteChamado[],
  colunas: TicketColuna[],
  nomes: Map<string, string>,
): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tickets");
  ws.columns = colunas.map((c) => ({ header: COLUNA_LABEL[c], key: c, width: 22 }));
  tickets.forEach((t) => {
    const row: Record<string, string> = {};
    colunas.forEach((c) => (row[c] = valorPorColuna(t, c, nomes)));
    ws.addRow(row);
  });
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
