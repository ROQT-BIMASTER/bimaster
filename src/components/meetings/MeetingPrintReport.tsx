import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileSpreadsheet, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface MeetingPrintReportProps {
  meeting: any;
  insights: any[];
  tasks: any[];
  risks: any[];
}

const SECTION_KEYS = [
  "overview",
  "charts",
  "scorecard",
  "summary",
  "insights",
  "tasks",
  "risks",
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_LABELS: Record<SectionKey, string> = {
  overview: "Visão Geral (KPIs)",
  charts: "Análise Gráfica",
  scorecard: "Scorecard de Performance",
  summary: "Resumo Executivo",
  insights: "Insights Detalhados",
  tasks: "Tarefas Identificadas",
  risks: "Riscos Identificados",
};

const RISK_COLORS: Record<string, string> = {
  critical: "#c0392b",
  high: "#e67e22",
  medium: "#f1c40f",
  low: "#27ae60",
};

const RISK_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const INSIGHT_LABELS: Record<string, string> = {
  risco: "Risco",
  oportunidade: "Oportunidade",
  decisao: "Decisão",
  bloqueio: "Bloqueio",
  problema: "Problema",
};

const INSIGHT_COLORS: Record<string, string> = {
  risco: "#c0392b",
  oportunidade: "#27ae60",
  decisao: "#2980b9",
  bloqueio: "#8e44ad",
  problema: "#e67e22",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  done: "Concluída",
  in_progress: "Em Andamento",
  pending: "Pendente",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const HEADER_ARGB = "FF1A5276";
const HEADER_FONT_ARGB = "FFFFFFFF";

export function MeetingPrintReport({ meeting, insights, tasks, risks }: MeetingPrintReportProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"pdf" | "excel">("pdf");
  const [selectedSections, setSelectedSections] = useState<Set<SectionKey>>(
    () => new Set(SECTION_KEYS)
  );

  const toggleSection = (key: SectionKey) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedSections(new Set(SECTION_KEYS));
  const selectNone = () => setSelectedSections(new Set());

  const risksByLevel = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach((r) => { counts[r.risk_level || "medium"] += 1; });
    return Object.entries(counts).map(([key, value]) => ({
      key, label: RISK_LABELS[key], value, color: RISK_COLORS[key],
    }));
  }, [risks]);

  const risksByDepartment = useMemo(() => {
    const deptMap: Record<string, { total: number; critical: number; high: number; medium: number; low: number }> = {};
    risks.forEach((r) => {
      const dept = r.department || "Não definido";
      if (!deptMap[dept]) deptMap[dept] = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
      deptMap[dept].total += 1;
      const level = r.risk_level || "medium";
      if (level in deptMap[dept]) (deptMap[dept] as any)[level] += 1;
    });
    return Object.entries(deptMap)
      .map(([dept, data]) => ({ department: dept, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [risks]);

  const insightsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    insights.forEach((i) => { counts[i.insight_type || "outro"] = (counts[i.insight_type || "outro"] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      key, label: INSIGHT_LABELS[key] || key, value, color: INSIGHT_COLORS[key] || "#7f8c8d",
    }));
  }, [insights]);

  const tasksByStatus = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.length - done - inProgress;
    return [
      { key: "done", label: "Concluídas", value: done, color: "#27ae60" },
      { key: "in_progress", label: "Em Andamento", value: inProgress, color: "#2980b9" },
      { key: "pending", label: "Pendentes", value: pending, color: "#f39c12" },
    ].filter((d) => d.value > 0);
  }, [tasks]);

  const radarData = useMemo(() => {
    const totalTasks = tasks.length || 1;
    const totalRisks = risks.length || 1;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const resolvedRisks = risks.filter((r) => r.status === "resolved").length;
    const highRisks = risks.filter((r) => r.risk_level === "critical" || r.risk_level === "high").length;
    return [
      { label: "Insights Gerados", value: Math.min(100, insights.length * 20) },
      { label: "Tarefas Concluídas", value: Math.round((completedTasks / totalTasks) * 100) },
      { label: "Riscos Resolvidos", value: Math.round((resolvedRisks / totalRisks) * 100) },
      { label: "Controle de Severidade", value: Math.max(0, 100 - Math.round((highRisks / totalRisks) * 100)) },
      { label: "Cobertura Analítica", value: insights.length > 0 && tasks.length > 0 && risks.length > 0 ? 100 : 50 },
    ];
  }, [insights, tasks, risks]);

  const overallScore = useMemo(() => {
    const avg = radarData.reduce((sum, d) => sum + d.value, 0) / radarData.length;
    return Math.round(avg);
  }, [radarData]);

  const durationText = meeting.duration_seconds
    ? `${Math.floor(meeting.duration_seconds / 60)}min ${meeting.duration_seconds % 60}s`
    : "N/A";

  const has = (key: SectionKey) => selectedSections.has(key);

  // ─── PRINT ───
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const maxInsightCount = Math.max(...insightsByType.map((d) => d.value), 1);
    const maxRiskLevel = Math.max(...risksByLevel.map((d) => d.value), 1);
    const maxRisksInDept = Math.max(...risksByDepartment.map((d) => d.total), 1);

    const scoreColor = overallScore >= 75 ? "#27ae60" : overallScore >= 50 ? "#f39c12" : "#c0392b";
    const scoreLabel = overallScore >= 75 ? "Excelente" : overallScore >= 50 ? "Moderado" : "Atenção Necessária";

    const figureCounter = { n: 0 };
    const fig = () => { figureCounter.n++; return `Figura ${figureCounter.n}`; };
    const tableCounter = { n: 0 };
    const tab = () => { tableCounter.n++; return `Tabela ${tableCounter.n}`; };

    let secNum = 0;
    const sec = () => { secNum++; return secNum; };

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Executivo — ${meeting.title}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 18mm; }
  @media print { .no-print { display: none !important; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #2c3e50; line-height: 1.65; background: #fff; font-size: 10.5pt;
    max-width: 174mm; margin: 0 auto;
  }
  .header {
    border-bottom: 3px solid #1a5276;
    padding-bottom: 18px; margin-bottom: 24px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .header-left h1 {
    font-size: 18pt; font-weight: 700; color: #1a5276;
    line-height: 1.2; margin-bottom: 4px; font-family: 'Segoe UI', Arial, sans-serif;
  }
  .header-left .subtitle { font-size: 9.5pt; color: #5d6d7e; font-style: italic; }
  .header-right {
    text-align: right; font-size: 8.5pt; color: #5d6d7e;
    font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.7;
  }
  .header-right .brand {
    font-size: 11pt; font-weight: 800; color: #1a5276;
    letter-spacing: 1.5px; font-family: 'Segoe UI', Arial, sans-serif;
  }
  h2 {
    font-size: 12pt; font-weight: 700; color: #1a5276;
    margin: 22px 0 8px 0; padding-bottom: 5px;
    border-bottom: 1.5px solid #d5dbdb;
    font-family: 'Segoe UI', Arial, sans-serif;
    page-break-after: avoid;
  }
  h2 .num { color: #2980b9; margin-right: 6px; }
  h3 {
    font-size: 10.5pt; font-weight: 700; color: #2c3e50;
    margin: 14px 0 6px 0; font-family: 'Segoe UI', Arial, sans-serif;
  }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 12px 0; }
  .kpi-strip {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
    border: 1px solid #d5dbdb; margin-bottom: 20px;
  }
  .kpi-item {
    padding: 12px 14px; text-align: center;
    border-right: 1px solid #d5dbdb;
  }
  .kpi-item:last-child { border-right: none; }
  .kpi-item .val {
    font-size: 20pt; font-weight: 800; color: #1a5276;
    font-family: 'Segoe UI', Arial, sans-serif; line-height: 1;
  }
  .kpi-item .lbl {
    font-size: 7.5pt; color: #7f8c8d; text-transform: uppercase;
    letter-spacing: 0.8px; margin-top: 4px;
    font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600;
  }
  .chart-box {
    border: 1px solid #d5dbdb; padding: 12px 14px; margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .chart-box .chart-title {
    font-size: 8.5pt; font-weight: 700; color: #2c3e50;
    font-family: 'Segoe UI', Arial, sans-serif;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eaecee;
  }
  .figure-label {
    font-size: 7.5pt; color: #7f8c8d; text-align: center;
    margin-top: 6px; font-style: italic;
  }
  .hbar { display: flex; align-items: center; margin-bottom: 6px; }
  .hbar-label {
    width: 95px; font-size: 8.5pt; font-weight: 600; color: #2c3e50;
    text-align: right; padding-right: 8px; flex-shrink: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .hbar-track { flex: 1; height: 16px; background: #eaecee; position: relative; }
  .hbar-fill { height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; }
  .hbar-fill span { font-size: 7.5pt; font-weight: 700; color: #fff; font-family: 'Segoe UI', sans-serif; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; font-family: 'Segoe UI', Arial, sans-serif; }
  .data-table th {
    text-align: left; font-weight: 700; color: #fff; background: #1a5276;
    padding: 6px 8px; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .data-table td { padding: 6px 8px; border-bottom: 1px solid #eaecee; color: #2c3e50; }
  .data-table tr:nth-child(even) td { background: #f8f9f9; }
  .data-table .bar-cell { width: 40%; }
  .table-bar-track { width: 100%; height: 7px; background: #eaecee; }
  .table-bar-fill { height: 100%; }
  .table-label { font-size: 7.5pt; color: #7f8c8d; text-align: center; margin-top: 5px; font-style: italic; }
  .score-panel { border: 1px solid #d5dbdb; padding: 16px; page-break-inside: avoid; }
  .score-panel-grid { display: grid; grid-template-columns: 130px 1fr; gap: 18px; align-items: center; }
  .score-ring {
    width: 110px; height: 110px; border-radius: 50%; position: relative;
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
  }
  .score-ring-inner {
    width: 82px; height: 82px; border-radius: 50%; background: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .score-num { font-size: 24pt; font-weight: 900; line-height: 1; font-family: 'Segoe UI', sans-serif; }
  .score-lbl { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; font-family: 'Segoe UI', sans-serif; }
  .dim-row { margin-bottom: 8px; }
  .dim-head { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .dim-name { font-size: 8.5pt; font-weight: 600; color: #2c3e50; font-family: 'Segoe UI', sans-serif; }
  .dim-val { font-size: 8.5pt; font-weight: 800; color: #1a5276; font-family: 'Segoe UI', sans-serif; }
  .dim-track { height: 5px; background: #eaecee; }
  .dim-fill { height: 100%; }
  .summary-block {
    background: #f8f9f9; border-left: 3px solid #1a5276;
    padding: 14px 18px; font-size: 9.5pt; line-height: 1.8;
    white-space: pre-wrap; color: #2c3e50;
  }
  .item-entry { border-bottom: 1px solid #eaecee; padding: 8px 0; page-break-inside: avoid; }
  .item-entry:last-child { border-bottom: none; }
  .item-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; flex-wrap: wrap; }
  .item-title { font-size: 9.5pt; font-weight: 700; color: #2c3e50; font-family: 'Segoe UI', Arial, sans-serif; }
  .item-desc { font-size: 8.5pt; color: #5d6d7e; line-height: 1.5; margin-top: 2px; }
  .item-action {
    font-size: 8.5pt; color: #2c3e50; margin-top: 5px; padding: 5px 8px;
    background: #f2f3f4; border-left: 2px solid #2980b9;
  }
  .item-action strong { color: #1a5276; }
  .tag {
    display: inline-block; padding: 1px 7px; font-size: 7pt;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    font-family: 'Segoe UI', Arial, sans-serif; border: 1px solid;
  }
  .tag-critical { color: #c0392b; border-color: #e6b0aa; background: #fdedec; }
  .tag-high { color: #e67e22; border-color: #f5cba7; background: #fef5e7; }
  .tag-medium { color: #b7950b; border-color: #f9e79f; background: #fef9e7; }
  .tag-low { color: #1e8449; border-color: #a9dfbf; background: #eafaf1; }
  .tag-dept { color: #2471a3; border-color: #aed6f1; background: #ebf5fb; }
  .tag-done { color: #1e8449; border-color: #a9dfbf; background: #eafaf1; }
  .tag-in_progress { color: #2471a3; border-color: #aed6f1; background: #ebf5fb; }
  .tag-pending { color: #b7950b; border-color: #f9e79f; background: #fef9e7; }
  .tag-insight { color: #fff; border: none; padding: 1px 9px; }
  .sev-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 3px; vertical-align: middle; }
  .footer {
    margin-top: 28px; padding-top: 10px;
    border-top: 2px solid #1a5276;
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .footer-left { font-size: 7.5pt; color: #7f8c8d; }
  .footer-right { font-size: 9pt; font-weight: 800; color: #1a5276; letter-spacing: 1px; }
  .footer-conf { font-size: 6.5pt; color: #aab7b8; text-align: center; margin-top: 5px; }
  .page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>${meeting.title}</h1>
    <div class="subtitle">Relatório Executivo de Análise de Reunião</div>
  </div>
  <div class="header-right">
    <div class="brand">BI MASTER</div>
    <div>${format(new Date(meeting.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
    <div>Duração: ${durationText}</div>
    <div>Status: ${meeting.status === "analyzed" ? "Analisada" : meeting.status}</div>
  </div>
</div>

${has("overview") ? `
<h2><span class="num">${sec()}.</span> Visão Geral</h2>
<p style="font-size:9.5pt;color:#5d6d7e;margin-bottom:12px;">
  Resumo quantitativo dos principais indicadores extraídos da análise inteligente desta reunião.
</p>
<div class="kpi-strip">
  <div class="kpi-item"><div class="val">${insights.length}</div><div class="lbl">Insights</div></div>
  <div class="kpi-item"><div class="val">${tasks.length}</div><div class="lbl">Tarefas</div></div>
  <div class="kpi-item"><div class="val">${risks.length}</div><div class="lbl">Riscos</div></div>
  <div class="kpi-item"><div class="val">${tasks.filter((t) => t.status === "done").length}<span style="font-size:11pt;color:#7f8c8d">/${tasks.length}</span></div><div class="lbl">Concluídas</div></div>
</div>
` : ""}

${has("charts") ? `
<h2><span class="num">${sec()}.</span> Análise Gráfica</h2>
<p style="font-size:9.5pt;color:#5d6d7e;margin-bottom:12px;">
  Representação visual da distribuição de insights, tarefas e riscos identificados durante a reunião.
</p>
<div class="two-col">
  <div class="chart-box">
    <div class="chart-title">Distribuição de Insights por Tipo</div>
    ${insightsByType.length > 0 ? insightsByType.map(d => `
    <div class="hbar">
      <div class="hbar-label">${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${(d.value / maxInsightCount) * 100}%;background:${d.color}"><span>${d.value}</span></div>
      </div>
    </div>`).join("") : '<div style="padding:16px;text-align:center;color:#aab7b8;font-size:8.5pt">Nenhum insight registrado</div>'}
    <div class="figure-label">${fig()} — Classificação dos insights por categoria</div>
  </div>
  <div class="chart-box">
    <div class="chart-title">Status de Tarefas</div>
    ${tasksByStatus.length > 0 ? tasksByStatus.map(d => `
    <div class="hbar">
      <div class="hbar-label">${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${tasks.length > 0 ? (d.value / tasks.length) * 100 : 0}%;background:${d.color}"><span>${d.value}</span></div>
      </div>
    </div>`).join("") : '<div style="padding:16px;text-align:center;color:#aab7b8;font-size:8.5pt">Nenhuma tarefa registrada</div>'}
    <div class="figure-label">${fig()} — Progresso das tarefas por status</div>
  </div>
</div>
<div class="two-col">
  <div class="chart-box">
    <div class="chart-title">Riscos por Nível de Severidade</div>
    ${risksByLevel.filter(d => d.value > 0).length > 0 ? risksByLevel.filter(d => d.value > 0).map(d => `
    <div class="hbar">
      <div class="hbar-label"><span class="sev-dot" style="background:${d.color}"></span>${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${(d.value / maxRiskLevel) * 100}%;background:${d.color}"><span>${d.value}</span></div>
      </div>
    </div>`).join("") : '<div style="padding:16px;text-align:center;color:#aab7b8;font-size:8.5pt">Nenhum risco identificado</div>'}
    <div class="figure-label">${fig()} — Distribuição de riscos por severidade</div>
  </div>
  <div class="chart-box">
    <div class="chart-title">Riscos por Departamento</div>
    ${risksByDepartment.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Departamento</th><th class="bar-cell">Incidência</th><th style="text-align:center">Total</th></tr></thead>
      <tbody>
      ${risksByDepartment.map(d => `
        <tr>
          <td style="font-weight:600">${d.department}</td>
          <td class="bar-cell"><div class="table-bar-track"><div class="table-bar-fill" style="width:${(d.total / maxRisksInDept) * 100}%;background:#e67e22"></div></div></td>
          <td style="text-align:center;font-weight:700">${d.total}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="table-label">${tab()} — Concentração de riscos por área</div>
    ` : '<div style="padding:16px;text-align:center;color:#aab7b8;font-size:8.5pt">Sem dados departamentais</div>'}
  </div>
</div>
` : ""}

${has("scorecard") && (insights.length > 0 || tasks.length > 0 || risks.length > 0) ? `
<h2><span class="num">${sec()}.</span> Scorecard de Performance</h2>
<p style="font-size:9.5pt;color:#5d6d7e;margin-bottom:12px;">
  Avaliação consolidada da qualidade analítica da reunião em cinco dimensões-chave.
</p>
<div class="score-panel">
  <div class="score-panel-grid">
    <div>
      <div class="score-ring" style="background:conic-gradient(${scoreColor} ${overallScore * 3.6}deg, #eaecee ${overallScore * 3.6}deg)">
        <div class="score-ring-inner">
          <div class="score-num" style="color:${scoreColor}">${overallScore}</div>
          <div class="score-lbl" style="color:${scoreColor}">${scoreLabel}</div>
        </div>
      </div>
      <div class="figure-label" style="margin-top:8px">${fig()} — Score geral</div>
    </div>
    <div>
      ${radarData.map(d => {
        const c = d.value >= 75 ? "#27ae60" : d.value >= 50 ? "#f39c12" : "#c0392b";
        return `
      <div class="dim-row">
        <div class="dim-head"><div class="dim-name">${d.label}</div><div class="dim-val">${d.value}%</div></div>
        <div class="dim-track"><div class="dim-fill" style="width:${d.value}%;background:${c}"></div></div>
      </div>`;
      }).join("")}
    </div>
  </div>
</div>
` : ""}

${has("summary") && meeting.summary ? `
<h2><span class="num">${sec()}.</span> Resumo Executivo</h2>
<div class="summary-block">${meeting.summary}</div>
` : ""}

${has("insights") && insights.length > 0 ? `
<div class="page-break"></div>
<h2><span class="num">${sec()}.</span> Insights Detalhados</h2>
<p style="font-size:9.5pt;color:#5d6d7e;margin-bottom:12px;">
  Foram identificados <strong>${insights.length} insights</strong> durante a análise desta reunião.
</p>
${insights.map((ins: any, idx: number) => {
  const bgColor = INSIGHT_COLORS[ins.insight_type] || "#7f8c8d";
  return `
<div class="item-entry">
  <div class="item-meta">
    <span style="font-size:8.5pt;font-weight:700;color:#7f8c8d;font-family:'Segoe UI',sans-serif;min-width:18px">${idx + 1}.</span>
    <span class="tag tag-insight" style="background:${bgColor}">${INSIGHT_LABELS[ins.insight_type] || ins.insight_type}</span>
    ${ins.impact_level ? `<span class="tag tag-${ins.impact_level}">Impacto ${PRIORITY_LABELS[ins.impact_level] || ins.impact_level}</span>` : ""}
    ${ins.department ? `<span class="tag tag-dept">${ins.department}</span>` : ""}
  </div>
  <div class="item-title">${ins.title}</div>
  ${ins.description ? `<div class="item-desc">${ins.description}</div>` : ""}
</div>`;
}).join("")}
` : ""}

${has("tasks") && tasks.length > 0 ? `
<h2><span class="num">${sec()}.</span> Tarefas Identificadas</h2>
<p style="font-size:9.5pt;color:#5d6d7e;margin-bottom:12px;">
  Foram extraídas <strong>${tasks.length} tarefas</strong> a partir dos pontos discutidos na reunião.
</p>
<table class="data-table">
  <thead><tr>
    <th style="width:5%">N.</th><th>Tarefa</th><th style="width:14%">Status</th>
    <th style="width:12%">Prioridade</th><th style="width:15%">Departamento</th>
  </tr></thead>
  <tbody>
  ${tasks.map((task: any, idx: number) => `
    <tr>
      <td style="font-weight:700;color:#7f8c8d">${idx + 1}</td>
      <td style="font-weight:600">${task.task}</td>
      <td><span class="tag tag-${task.status || "pending"}">${TASK_STATUS_LABELS[task.status] || "Pendente"}</span></td>
      <td>${task.priority ? `<span class="tag tag-${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>` : "—"}</td>
      <td>${task.department || "—"}</td>
    </tr>`).join("")}
  </tbody>
</table>
<div class="table-label">${tab()} — Lista completa de tarefas com status e prioridade</div>
` : ""}

${has("risks") && risks.length > 0 ? `
<h2><span class="num">${sec()}.</span> Riscos Identificados</h2>
<p style="font-size:9.5pt;color:#5d6d7e;margin-bottom:12px;">
  A análise identificou <strong>${risks.length} riscos</strong> que requerem acompanhamento e mitigação.
</p>
${risks.map((risk: any, idx: number) => {
  const riskColor = RISK_COLORS[risk.risk_level] || "#f1c40f";
  return `
<div class="item-entry">
  <div class="item-meta">
    <span style="font-size:8.5pt;font-weight:700;color:#7f8c8d;font-family:'Segoe UI',sans-serif;min-width:18px">${idx + 1}.</span>
    <span class="sev-dot" style="background:${riskColor}"></span>
    <span class="tag tag-${risk.risk_level || "medium"}">${RISK_LABELS[risk.risk_level] || risk.risk_level}</span>
    ${risk.department ? `<span class="tag tag-dept">${risk.department}</span>` : ""}
    ${risk.probability ? `<span style="font-size:7.5pt;color:#7f8c8d;font-family:'Segoe UI',sans-serif">Prob. ${risk.probability}%</span>` : ""}
  </div>
  <div class="item-title">${risk.title}</div>
  ${risk.description ? `<div class="item-desc">${risk.description}</div>` : ""}
  ${risk.recommended_action ? `
  <div class="item-action"><strong>Ação recomendada:</strong> ${risk.recommended_action}</div>` : ""}
</div>`;
}).join("")}
` : ""}

<div class="footer">
  <div class="footer-left">
    Relatório gerado automaticamente por análise de Inteligência Artificial<br>
    ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
  </div>
  <div class="footer-right">BI MASTER</div>
</div>
<div class="footer-conf">Documento confidencial — Distribuição restrita</div>

</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
    setDialogOpen(false);
  };

  // ─── EXCEL EXPORT ───
  const handleExcelExport = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "BI Master";
    wb.created = new Date();

    const applyHeaderStyle = (ws: ExcelJS.Worksheet) => {
      const row = ws.getRow(1);
      row.font = { bold: true, color: { argb: HEADER_FONT_ARGB }, size: 10 };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.height = 22;
    };

    const applyBorders = (ws: ExcelJS.Worksheet) => {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });
    };

    const applyAlternatingRows = (ws: ExcelJS.Worksheet) => {
      ws.eachRow((row, rowNum) => {
        if (rowNum > 1 && rowNum % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9F9" } };
          });
        }
      });
    };

    // === RESUMO ===
    if (has("overview") || has("scorecard") || has("summary")) {
      const ws = wb.addWorksheet("Resumo");
      ws.columns = [
        { header: "Indicador", key: "indicador", width: 30 },
        { header: "Valor", key: "valor", width: 20 },
      ];

      if (has("overview")) {
        ws.addRow({ indicador: "Reunião", valor: meeting.title });
        ws.addRow({ indicador: "Data", valor: format(new Date(meeting.created_at), "dd/MM/yyyy") });
        ws.addRow({ indicador: "Duração", valor: durationText });
        ws.addRow({ indicador: "Total de Insights", valor: insights.length });
        ws.addRow({ indicador: "Total de Tarefas", valor: tasks.length });
        ws.addRow({ indicador: "Tarefas Concluídas", valor: tasks.filter(t => t.status === "done").length });
        ws.addRow({ indicador: "Total de Riscos", valor: risks.length });
      }

      if (has("scorecard")) {
        ws.addRow({ indicador: "", valor: "" });
        ws.addRow({ indicador: "SCORECARD", valor: "" });
        ws.addRow({ indicador: "Score Geral", valor: `${overallScore}/100` });
        radarData.forEach(d => {
          ws.addRow({ indicador: d.label, valor: `${d.value}%` });
        });
      }

      if (has("summary") && meeting.summary) {
        ws.addRow({ indicador: "", valor: "" });
        ws.addRow({ indicador: "RESUMO EXECUTIVO", valor: meeting.summary });
      }

      applyHeaderStyle(ws);
      applyBorders(ws);
      applyAlternatingRows(ws);
      ws.getColumn("valor").alignment = { wrapText: true };
    }

    // === INSIGHTS ===
    if (has("insights") && insights.length > 0) {
      const ws = wb.addWorksheet("Insights");
      ws.columns = [
        { header: "N.", key: "n", width: 5 },
        { header: "Tipo", key: "tipo", width: 15 },
        { header: "Título", key: "titulo", width: 35 },
        { header: "Descrição", key: "descricao", width: 50 },
        { header: "Impacto", key: "impacto", width: 12 },
        { header: "Departamento", key: "departamento", width: 18 },
      ];
      insights.forEach((ins, idx) => {
        ws.addRow({
          n: idx + 1,
          tipo: INSIGHT_LABELS[ins.insight_type] || ins.insight_type || "",
          titulo: ins.title || "",
          descricao: ins.description || "",
          impacto: PRIORITY_LABELS[ins.impact_level] || ins.impact_level || "",
          departamento: ins.department || "",
        });
      });
      applyHeaderStyle(ws);
      applyBorders(ws);
      applyAlternatingRows(ws);
      ws.autoFilter = "A1:F1";
      ws.getColumn("descricao").alignment = { wrapText: true };
    }

    // === TAREFAS ===
    if (has("tasks") && tasks.length > 0) {
      const ws = wb.addWorksheet("Tarefas");
      ws.columns = [
        { header: "N.", key: "n", width: 5 },
        { header: "Tarefa", key: "tarefa", width: 40 },
        { header: "Status", key: "status", width: 15 },
        { header: "Prioridade", key: "prioridade", width: 12 },
        { header: "Departamento", key: "departamento", width: 18 },
      ];
      tasks.forEach((task, idx) => {
        ws.addRow({
          n: idx + 1,
          tarefa: task.task || "",
          status: TASK_STATUS_LABELS[task.status] || "Pendente",
          prioridade: PRIORITY_LABELS[task.priority] || task.priority || "",
          departamento: task.department || "",
        });
      });
      applyHeaderStyle(ws);
      applyBorders(ws);
      applyAlternatingRows(ws);
      ws.autoFilter = "A1:E1";
    }

    // === RISCOS ===
    if (has("risks") && risks.length > 0) {
      const ws = wb.addWorksheet("Riscos");
      ws.columns = [
        { header: "N.", key: "n", width: 5 },
        { header: "Título", key: "titulo", width: 35 },
        { header: "Severidade", key: "severidade", width: 12 },
        { header: "Departamento", key: "departamento", width: 18 },
        { header: "Probabilidade", key: "probabilidade", width: 14 },
        { header: "Descrição", key: "descricao", width: 40 },
        { header: "Ação Recomendada", key: "acao", width: 40 },
      ];
      risks.forEach((risk, idx) => {
        ws.addRow({
          n: idx + 1,
          titulo: risk.title || "",
          severidade: RISK_LABELS[risk.risk_level] || risk.risk_level || "",
          departamento: risk.department || "",
          probabilidade: risk.probability ? `${risk.probability}%` : "",
          descricao: risk.description || "",
          acao: risk.recommended_action || "",
        });
      });
      applyHeaderStyle(ws);
      applyBorders(ws);
      applyAlternatingRows(ws);
      ws.autoFilter = "A1:G1";
      ws.getColumn("descricao").alignment = { wrapText: true };
      ws.getColumn("acao").alignment = { wrapText: true };
    }

    // === GRÁFICOS (aba de dados para gráficos) ===
    if (has("charts")) {
      const ws = wb.addWorksheet("Dados Gráficos");
      // Insights by type
      ws.getCell("A1").value = "Distribuição de Insights";
      ws.getCell("A1").font = { bold: true, size: 11, color: { argb: HEADER_ARGB } };
      ws.getCell("A2").value = "Tipo";
      ws.getCell("B2").value = "Quantidade";
      ws.getRow(2).font = { bold: true, color: { argb: HEADER_FONT_ARGB } };
      ws.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
      insightsByType.forEach((d, i) => {
        ws.getCell(`A${3 + i}`).value = d.label;
        ws.getCell(`B${3 + i}`).value = d.value;
      });

      const startRow = 3 + insightsByType.length + 2;
      // Tasks by status
      ws.getCell(`A${startRow}`).value = "Status de Tarefas";
      ws.getCell(`A${startRow}`).font = { bold: true, size: 11, color: { argb: HEADER_ARGB } };
      ws.getCell(`A${startRow + 1}`).value = "Status";
      ws.getCell(`B${startRow + 1}`).value = "Quantidade";
      ws.getRow(startRow + 1).font = { bold: true, color: { argb: HEADER_FONT_ARGB } };
      ws.getRow(startRow + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
      tasksByStatus.forEach((d, i) => {
        ws.getCell(`A${startRow + 2 + i}`).value = d.label;
        ws.getCell(`B${startRow + 2 + i}`).value = d.value;
      });

      const startRow2 = startRow + 2 + tasksByStatus.length + 2;
      // Risks by level
      ws.getCell(`A${startRow2}`).value = "Riscos por Severidade";
      ws.getCell(`A${startRow2}`).font = { bold: true, size: 11, color: { argb: HEADER_ARGB } };
      ws.getCell(`A${startRow2 + 1}`).value = "Severidade";
      ws.getCell(`B${startRow2 + 1}`).value = "Quantidade";
      ws.getRow(startRow2 + 1).font = { bold: true, color: { argb: HEADER_FONT_ARGB } };
      ws.getRow(startRow2 + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
      risksByLevel.filter(d => d.value > 0).forEach((d, i) => {
        ws.getCell(`A${startRow2 + 2 + i}`).value = d.label;
        ws.getCell(`B${startRow2 + 2 + i}`).value = d.value;
      });

      ws.getColumn("A").width = 25;
      ws.getColumn("B").width = 15;
      applyBorders(ws);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const timestamp = format(new Date(), "yyyy-MM-dd");
    saveAs(blob, `Relatorio_${meeting.title.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.xlsx`);
    setDialogOpen(false);
  };

  const openDialog = (mode: "pdf" | "excel") => {
    setExportMode(mode);
    setDialogOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Relatório
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openDialog("pdf")} className="gap-2 cursor-pointer">
            <Printer className="h-4 w-4" />
            Imprimir PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("excel")} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {exportMode === "pdf" ? "Configurar Impressão PDF" : "Configurar Exportação Excel"}
            </DialogTitle>
            <DialogDescription>
              Selecione as seções que deseja incluir no relatório.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex gap-3 mb-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7 px-2">
                Selecionar Tudo
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs h-7 px-2">
                Limpar Seleção
              </Button>
            </div>

            {SECTION_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1.5 transition-colors"
              >
                <Checkbox
                  checked={selectedSections.has(key)}
                  onCheckedChange={() => toggleSection(key)}
                />
                <span className="text-sm">{SECTION_LABELS[key]}</span>
              </label>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            {exportMode === "pdf" ? (
              <Button
                size="sm"
                onClick={handlePrint}
                disabled={selectedSections.size === 0}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimir PDF
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleExcelExport}
                disabled={selectedSections.size === 0}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
