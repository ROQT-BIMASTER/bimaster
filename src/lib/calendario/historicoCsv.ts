// Exportação CSV do histórico de alterações do Calendário Geral.
// BOM UTF-8 + escape estilo Excel pt-BR.
import { format } from "date-fns";
import type { CalendarioHistoricoEntry } from "@/hooks/useCalendarioHistorico";
import { rotuloCampo } from "@/hooks/useCalendarioHistorico";

const BOM = "\uFEFF";
const SEP = ";";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ACAO_LABEL: Record<string, string> = {
  criado: "Criado",
  editado: "Editado",
  reagendado: "Reagendado",
  excluido: "Excluído",
};

export interface HistoricoCsvMeta {
  /** Rótulo do escopo exportado (evento específico ou "Todos os eventos"). */
  escopo: string;
  periodo: string;
}

export function buildHistoricoCsv(
  entradas: CalendarioHistoricoEntry[],
  meta: HistoricoCsvMeta,
): Blob {
  const linhas: string[][] = [
    [`Histórico do Calendário Geral`],
    [`Escopo: ${meta.escopo}`],
    [`Período: ${meta.periodo}`],
    [],
    ["Data/hora", "Autor", "Ação", "Alcance", "Campo", "De", "Para", "Evento"],
  ];

  entradas.forEach((h) => {
    const quando = format(new Date(h.created_at), "dd/MM/yyyy HH:mm");
    const base = [
      quando,
      h.autor_nome ?? "Usuário do sistema",
      ACAO_LABEL[h.acao] ?? h.acao,
      h.escopo === "serie" ? "Série inteira" : "Somente esta ocorrência",
    ];
    if (!h.alteracoes.length) {
      linhas.push([...base, "—", "—", "—", h.evento_id]);
      return;
    }
    h.alteracoes.forEach((a) => {
      linhas.push([...base, rotuloCampo(a.campo), a.de ?? "—", a.para ?? "—", h.evento_id]);
    });
  });

  const csv = BOM + linhas.map((r) => r.map(esc).join(SEP)).join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export function downloadCsv(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
