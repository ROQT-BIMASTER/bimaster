// src/lib/briefings/exportXlsx.ts
import ExcelJS from "exceljs";
import { formatInTimeZone } from "date-fns-tz";
import type { Briefing, TemplateSection } from "@/hooks/useBriefingChat";
import type { BriefingExportConfig } from "./exportTypes";

const TZ_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const fmt = (d: Date | string | null | undefined) =>
  d ? TZ_FMT.format(new Date(d)) : "—";


interface AprovacaoEtapa {
  ordem: number;
  nome: string;
  responsaveis: string[];
  status: string;
  decidido_em?: string | null;
  parecer?: string | null;
}

export interface BriefingExportData {
  briefing: Briefing;
  sections: TemplateSection[];
  config: BriefingExportConfig;
  projetoNome?: string | null;
  aprovacoes?: AprovacaoEtapa[];
  resumo?: { resumo: string; mensagem_chave: string; riscos: string[] } | null;
  autorNome?: string | null;
}

export async function exportBriefingXlsx(data: BriefingExportData): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lovable Cloud";
  wb.created = new Date();

  const primaryHex = (data.config.corPrimaria || "#0F172A").replace("#", "");

  // ===== Aba Briefing =====
  const ws = wb.addWorksheet("Briefing");
  ws.columns = [
    { header: "Campo", key: "campo", width: 32 },
    { header: "Conteúdo", key: "valor", width: 80 },
    { header: "Status", key: "status", width: 14 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${primaryHex}` },
  };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const sec of data.sections) {
    const val = (data.briefing.payload?.[sec.key] ?? "").trim();
    const row = ws.addRow({
      campo: sec.label + (sec.required ? " *" : ""),
      valor: val || "—",
      status: val ? "Preenchido" : "Vazio",
    });
    row.alignment = { wrapText: true, vertical: "top" };
    row.getCell("status").font = {
      color: { argb: val ? "FF065F46" : "FF92400E" },
      bold: true,
    };
  }

  // ===== Aba Aprovações =====
  if (data.config.incluir.aprovacoes && data.aprovacoes && data.aprovacoes.length) {
    const wsA = wb.addWorksheet("Aprovações");
    wsA.columns = [
      { header: "Ordem", key: "ordem", width: 8 },
      { header: "Etapa", key: "nome", width: 32 },
      { header: "Responsáveis", key: "resp", width: 40 },
      { header: "Status", key: "status", width: 16 },
      { header: "Decidido em", key: "dt", width: 20 },
      { header: "Parecer", key: "parecer", width: 60 },
    ];
    wsA.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    wsA.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${primaryHex}` },
    };
    wsA.views = [{ state: "frozen", ySplit: 1 }];

    for (const et of data.aprovacoes) {
      const row = wsA.addRow({
        ordem: et.ordem,
        nome: et.nome,
        resp: et.responsaveis.join(", "),
        status: et.status,
        dt: fmt(et.decidido_em),
        parecer: et.parecer || "—",
      });
      row.alignment = { wrapText: true, vertical: "top" };
    }
  }

  // ===== Aba Metadados =====
  const wsM = wb.addWorksheet("Metadados");
  wsM.columns = [
    { header: "Campo", key: "k", width: 28 },
    { header: "Valor", key: "v", width: 60 },
  ];
  wsM.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  wsM.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${primaryHex}` },
  };
  const meta: Array<[string, string]> = [
    ["ID do briefing", data.briefing.id],
    ["Título", data.briefing.titulo],
    ["Tipo", data.briefing.tipo],
    ["Status", data.briefing.status],
    ["Completude", `${data.briefing.completude}%`],
    ["Projeto vinculado", data.projetoNome || "—"],
    ["Autor", data.autorNome || "—"],
    ["Exportado em", fmt(new Date())],
    ["Idioma", data.config.idioma],
    ["Nível", data.config.nivel],
  ];
  for (const [k, v] of meta) wsM.addRow({ k, v });

  // ===== Aba Resumo Executivo =====
  if (data.config.incluir.resumoExecutivo && data.resumo) {
    const wsR = wb.addWorksheet("Resumo Executivo");
    wsR.columns = [
      { header: "Seção", key: "k", width: 24 },
      { header: "Conteúdo", key: "v", width: 90 },
    ];
    wsR.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    wsR.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${primaryHex}` },
    };
    wsR.addRow({ k: "Resumo", v: data.resumo.resumo || "—" }).alignment = {
      wrapText: true,
      vertical: "top",
    };
    wsR.addRow({ k: "Mensagem-chave", v: data.resumo.mensagem_chave || "—" }).alignment = {
      wrapText: true,
      vertical: "top",
    };
    if (data.resumo.riscos?.length) {
      wsR.addRow({
        k: "Riscos identificados",
        v: data.resumo.riscos.map((r, i) => `${i + 1}. ${r}`).join("\n"),
      }).alignment = { wrapText: true, vertical: "top" };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
