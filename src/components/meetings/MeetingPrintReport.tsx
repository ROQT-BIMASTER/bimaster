import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeetingPrintReportProps {
  meeting: any;
  insights: any[];
  tasks: any[];
  risks: any[];
}

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

export function MeetingPrintReport({ meeting, insights, tasks, risks }: MeetingPrintReportProps) {

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

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const maxInsightCount = Math.max(...insightsByType.map(d => d.value), 1);
    const maxRiskLevel = Math.max(...risksByLevel.map(d => d.value), 1);
    const maxRisksInDept = Math.max(...risksByDepartment.map(d => d.total), 1);

    const scoreColor = overallScore >= 75 ? "#27ae60" : overallScore >= 50 ? "#f39c12" : "#c0392b";
    const scoreLabel = overallScore >= 75 ? "Excelente" : overallScore >= 50 ? "Moderado" : "Atenção Necessária";

    const figureCounter = { n: 0 };
    const fig = () => { figureCounter.n++; return `Figura ${figureCounter.n}`; };

    const tableCounter = { n: 0 };
    const tab = () => { tableCounter.n++; return `Tabela ${tableCounter.n}`; };

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Executivo — ${meeting.title}</title>
<style>
  @page { size: A4; margin: 18mm 20mm; }
  @media print { .no-print { display: none !important; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #2c3e50; line-height: 1.65; background: #fff; font-size: 11pt;
  }

  /* === HEADER === */
  .header {
    border-bottom: 3px solid #1a5276;
    padding-bottom: 18px; margin-bottom: 28px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .header-left h1 {
    font-size: 20pt; font-weight: 700; color: #1a5276;
    line-height: 1.2; margin-bottom: 4px; font-family: 'Segoe UI', Arial, sans-serif;
  }
  .header-left .subtitle {
    font-size: 10pt; color: #5d6d7e; font-style: italic;
  }
  .header-right {
    text-align: right; font-size: 9pt; color: #5d6d7e;
    font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.7;
  }
  .header-right .brand {
    font-size: 12pt; font-weight: 800; color: #1a5276;
    letter-spacing: 1.5px; font-family: 'Segoe UI', Arial, sans-serif;
  }

  /* === SECTION HEADINGS === */
  h2 {
    font-size: 13pt; font-weight: 700; color: #1a5276;
    margin: 24px 0 10px 0; padding-bottom: 6px;
    border-bottom: 1.5px solid #d5dbdb;
    font-family: 'Segoe UI', Arial, sans-serif;
    page-break-after: avoid;
  }
  h2 .num { color: #2980b9; margin-right: 6px; }
  h3 {
    font-size: 11pt; font-weight: 700; color: #2c3e50;
    margin: 16px 0 8px 0; font-family: 'Segoe UI', Arial, sans-serif;
  }

  /* === TWO COLUMN LAYOUT === */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 14px 0; }
  .two-col-wide-left { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; margin: 14px 0; }

  /* === KPI STRIP === */
  .kpi-strip {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
    border: 1px solid #d5dbdb; border-radius: 0; margin-bottom: 24px;
  }
  .kpi-item {
    padding: 14px 16px; text-align: center;
    border-right: 1px solid #d5dbdb;
  }
  .kpi-item:last-child { border-right: none; }
  .kpi-item .val {
    font-size: 22pt; font-weight: 800; color: #1a5276;
    font-family: 'Segoe UI', Arial, sans-serif; line-height: 1;
  }
  .kpi-item .lbl {
    font-size: 8pt; color: #7f8c8d; text-transform: uppercase;
    letter-spacing: 0.8px; margin-top: 4px;
    font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600;
  }

  /* === CHART BOX === */
  .chart-box {
    border: 1px solid #d5dbdb; padding: 14px 16px; margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .chart-box .chart-title {
    font-size: 9pt; font-weight: 700; color: #2c3e50;
    font-family: 'Segoe UI', Arial, sans-serif;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #eaecee;
  }
  .figure-label {
    font-size: 8pt; color: #7f8c8d; text-align: center;
    margin-top: 8px; font-style: italic;
  }

  /* === HORIZONTAL BARS === */
  .hbar { display: flex; align-items: center; margin-bottom: 8px; }
  .hbar-label {
    width: 100px; font-size: 9pt; font-weight: 600; color: #2c3e50;
    text-align: right; padding-right: 10px; flex-shrink: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .hbar-track { flex: 1; height: 18px; background: #eaecee; position: relative; }
  .hbar-fill { height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
  .hbar-fill span { font-size: 8pt; font-weight: 700; color: #fff; font-family: 'Segoe UI', sans-serif; }
  .hbar-val {
    width: 30px; text-align: center; font-size: 9pt; font-weight: 700;
    color: #2c3e50; font-family: 'Segoe UI', sans-serif; padding-left: 6px;
  }

  /* === TABLE === */
  .data-table { width: 100%; border-collapse: collapse; font-size: 9pt; font-family: 'Segoe UI', Arial, sans-serif; }
  .data-table th {
    text-align: left; font-weight: 700; color: #fff; background: #1a5276;
    padding: 7px 10px; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .data-table td { padding: 8px 10px; border-bottom: 1px solid #eaecee; color: #2c3e50; }
  .data-table tr:nth-child(even) td { background: #f8f9f9; }
  .data-table .bar-cell { width: 40%; }
  .table-bar-track { width: 100%; height: 8px; background: #eaecee; }
  .table-bar-fill { height: 100%; }
  .table-label { font-size: 8pt; color: #7f8c8d; text-align: center; margin-top: 6px; font-style: italic; }

  /* === SCORE PANEL === */
  .score-panel {
    border: 1px solid #d5dbdb; padding: 18px; page-break-inside: avoid;
  }
  .score-panel-grid { display: grid; grid-template-columns: 140px 1fr; gap: 20px; align-items: center; }
  .score-ring {
    width: 120px; height: 120px; border-radius: 50%; position: relative;
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
  }
  .score-ring-inner {
    width: 88px; height: 88px; border-radius: 50%; background: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .score-num { font-size: 26pt; font-weight: 900; line-height: 1; font-family: 'Segoe UI', sans-serif; }
  .score-lbl { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; font-family: 'Segoe UI', sans-serif; }
  .dim-row { margin-bottom: 10px; }
  .dim-head { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .dim-name { font-size: 9pt; font-weight: 600; color: #2c3e50; font-family: 'Segoe UI', sans-serif; }
  .dim-val { font-size: 9pt; font-weight: 800; color: #1a5276; font-family: 'Segoe UI', sans-serif; }
  .dim-track { height: 6px; background: #eaecee; }
  .dim-fill { height: 100%; }

  /* === SUMMARY === */
  .summary-block {
    background: #f8f9f9; border-left: 3px solid #1a5276;
    padding: 16px 20px; font-size: 10pt; line-height: 1.8;
    white-space: pre-wrap; color: #2c3e50;
  }

  /* === ITEM LIST === */
  .item-entry {
    border-bottom: 1px solid #eaecee; padding: 10px 0;
    page-break-inside: avoid;
  }
  .item-entry:last-child { border-bottom: none; }
  .item-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
  .item-title { font-size: 10pt; font-weight: 700; color: #2c3e50; font-family: 'Segoe UI', Arial, sans-serif; }
  .item-desc { font-size: 9pt; color: #5d6d7e; line-height: 1.5; margin-top: 3px; }
  .item-action {
    font-size: 9pt; color: #2c3e50; margin-top: 6px; padding: 6px 10px;
    background: #f2f3f4; border-left: 2px solid #2980b9;
  }
  .item-action strong { color: #1a5276; }

  /* === TAGS === */
  .tag {
    display: inline-block; padding: 2px 8px; font-size: 7pt;
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
  .tag-insight { color: #fff; border: none; padding: 2px 10px; }

  /* === SEVERITY INDICATOR === */
  .sev-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle;
  }

  /* === FOOTER === */
  .footer {
    margin-top: 30px; padding-top: 12px;
    border-top: 2px solid #1a5276;
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .footer-left { font-size: 8pt; color: #7f8c8d; }
  .footer-right { font-size: 10pt; font-weight: 800; color: #1a5276; letter-spacing: 1px; }
  .footer-conf { font-size: 7pt; color: #aab7b8; text-align: center; margin-top: 6px; }

  /* === PAGE BREAKS === */
  .page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
</style>
</head>
<body>

<!-- HEADER -->
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

<!-- 1. OVERVIEW -->
<h2><span class="num">1.</span> Visão Geral</h2>
<p style="font-size:10pt;color:#5d6d7e;margin-bottom:14px;">
  Resumo quantitativo dos principais indicadores extraídos da análise inteligente desta reunião.
</p>

<div class="kpi-strip">
  <div class="kpi-item">
    <div class="val">${insights.length}</div>
    <div class="lbl">Insights</div>
  </div>
  <div class="kpi-item">
    <div class="val">${tasks.length}</div>
    <div class="lbl">Tarefas</div>
  </div>
  <div class="kpi-item">
    <div class="val">${risks.length}</div>
    <div class="lbl">Riscos</div>
  </div>
  <div class="kpi-item">
    <div class="val">${tasks.filter((t) => t.status === "done").length}<span style="font-size:12pt;color:#7f8c8d">/${tasks.length}</span></div>
    <div class="lbl">Concluídas</div>
  </div>
</div>

<!-- 2. ANÁLISE GRÁFICA -->
<h2><span class="num">2.</span> Análise Gráfica</h2>
<p style="font-size:10pt;color:#5d6d7e;margin-bottom:14px;">
  Representação visual da distribuição de insights, tarefas e riscos identificados durante a reunião.
</p>

<div class="two-col">
  <!-- Insights -->
  <div class="chart-box">
    <div class="chart-title">Distribuição de Insights por Tipo</div>
    ${insightsByType.length > 0 ? insightsByType.map(d => `
    <div class="hbar">
      <div class="hbar-label">${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${(d.value / maxInsightCount) * 100}%;background:${d.color}">
          <span>${d.value}</span>
        </div>
      </div>
    </div>`).join("") : '<div style="padding:20px;text-align:center;color:#aab7b8;font-size:9pt">Nenhum insight registrado</div>'}
    <div class="figure-label">${fig()} — Classificação dos insights por categoria</div>
  </div>

  <!-- Tasks -->
  <div class="chart-box">
    <div class="chart-title">Status de Tarefas</div>
    ${tasksByStatus.length > 0 ? tasksByStatus.map(d => `
    <div class="hbar">
      <div class="hbar-label">${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${tasks.length > 0 ? (d.value / tasks.length) * 100 : 0}%;background:${d.color}">
          <span>${d.value}</span>
        </div>
      </div>
    </div>`).join("") : '<div style="padding:20px;text-align:center;color:#aab7b8;font-size:9pt">Nenhuma tarefa registrada</div>'}
    <div class="figure-label">${fig()} — Progresso das tarefas por status</div>
  </div>
</div>

<div class="two-col">
  <!-- Risks by Level -->
  <div class="chart-box">
    <div class="chart-title">Riscos por Nível de Severidade</div>
    ${risksByLevel.filter(d => d.value > 0).length > 0 ? risksByLevel.filter(d => d.value > 0).map(d => `
    <div class="hbar">
      <div class="hbar-label"><span class="sev-dot" style="background:${d.color}"></span>${d.label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${(d.value / maxRiskLevel) * 100}%;background:${d.color}">
          <span>${d.value}</span>
        </div>
      </div>
    </div>`).join("") : '<div style="padding:20px;text-align:center;color:#aab7b8;font-size:9pt">Nenhum risco identificado</div>'}
    <div class="figure-label">${fig()} — Distribuição de riscos por severidade</div>
  </div>

  <!-- Risks by Dept -->
  <div class="chart-box">
    <div class="chart-title">Riscos por Departamento</div>
    ${risksByDepartment.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Departamento</th><th class="bar-cell">Incidência</th><th style="text-align:center">Total</th></tr></thead>
      <tbody>
      ${risksByDepartment.map(d => `
        <tr>
          <td style="font-weight:600">${d.department}</td>
          <td class="bar-cell">
            <div class="table-bar-track">
              <div class="table-bar-fill" style="width:${(d.total / maxRisksInDept) * 100}%;background:#e67e22"></div>
            </div>
          </td>
          <td style="text-align:center;font-weight:700">${d.total}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="table-label">${tab()} — Concentração de riscos por área</div>
    ` : '<div style="padding:20px;text-align:center;color:#aab7b8;font-size:9pt">Sem dados departamentais</div>'}
  </div>
</div>

<!-- 3. SCORECARD -->
${(insights.length > 0 || tasks.length > 0 || risks.length > 0) ? `
<h2><span class="num">3.</span> Scorecard de Performance</h2>
<p style="font-size:10pt;color:#5d6d7e;margin-bottom:14px;">
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
      <div class="figure-label" style="margin-top:10px">${fig()} — Score geral</div>
    </div>
    <div>
      ${radarData.map(d => {
        const c = d.value >= 75 ? "#27ae60" : d.value >= 50 ? "#f39c12" : "#c0392b";
        return `
      <div class="dim-row">
        <div class="dim-head">
          <div class="dim-name">${d.label}</div>
          <div class="dim-val">${d.value}%</div>
        </div>
        <div class="dim-track">
          <div class="dim-fill" style="width:${d.value}%;background:${c}"></div>
        </div>
      </div>`;
      }).join("")}
    </div>
  </div>
</div>
` : ""}

<!-- 4. RESUMO EXECUTIVO -->
${meeting.summary ? `
<h2><span class="num">${insights.length > 0 || tasks.length > 0 || risks.length > 0 ? "4" : "3"}.</span> Resumo Executivo</h2>
<div class="summary-block">${meeting.summary}</div>
` : ""}

<!-- 5. INSIGHTS -->
${insights.length > 0 ? `
<div class="page-break"></div>
<h2><span class="num">${meeting.summary ? "5" : "4"}.</span> Insights Detalhados</h2>
<p style="font-size:10pt;color:#5d6d7e;margin-bottom:14px;">
  Foram identificados <strong>${insights.length} insights</strong> durante a análise desta reunião, classificados por tipo e nível de impacto.
</p>
${insights.map((ins: any, idx: number) => {
  const bgColor = INSIGHT_COLORS[ins.insight_type] || "#7f8c8d";
  return `
<div class="item-entry">
  <div class="item-meta">
    <span style="font-size:9pt;font-weight:700;color:#7f8c8d;font-family:'Segoe UI',sans-serif;min-width:20px">${idx + 1}.</span>
    <span class="tag tag-insight" style="background:${bgColor}">${INSIGHT_LABELS[ins.insight_type] || ins.insight_type}</span>
    ${ins.impact_level ? `<span class="tag tag-${ins.impact_level}">Impacto ${PRIORITY_LABELS[ins.impact_level] || ins.impact_level}</span>` : ""}
    ${ins.department ? `<span class="tag tag-dept">${ins.department}</span>` : ""}
  </div>
  <div class="item-title">${ins.title}</div>
  ${ins.description ? `<div class="item-desc">${ins.description}</div>` : ""}
</div>`;
}).join("")}
` : ""}

<!-- 6. TAREFAS -->
${tasks.length > 0 ? `
<h2><span class="num">${(meeting.summary ? 5 : 4) + (insights.length > 0 ? 1 : 0)}.</span> Tarefas Identificadas</h2>
<p style="font-size:10pt;color:#5d6d7e;margin-bottom:14px;">
  Foram extraídas <strong>${tasks.length} tarefas</strong> a partir dos pontos discutidos na reunião.
</p>
<table class="data-table">
  <thead>
    <tr>
      <th style="width:5%">N.</th>
      <th>Tarefa</th>
      <th style="width:14%">Status</th>
      <th style="width:12%">Prioridade</th>
      <th style="width:15%">Departamento</th>
    </tr>
  </thead>
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

<!-- 7. RISCOS -->
${risks.length > 0 ? `
<h2><span class="num">${(meeting.summary ? 5 : 4) + (insights.length > 0 ? 1 : 0) + (tasks.length > 0 ? 1 : 0)}.</span> Riscos Identificados</h2>
<p style="font-size:10pt;color:#5d6d7e;margin-bottom:14px;">
  A análise identificou <strong>${risks.length} riscos</strong> que requerem acompanhamento e mitigação.
</p>
${risks.map((risk: any, idx: number) => {
  const riskColor = RISK_COLORS[risk.risk_level] || "#f1c40f";
  return `
<div class="item-entry">
  <div class="item-meta">
    <span style="font-size:9pt;font-weight:700;color:#7f8c8d;font-family:'Segoe UI',sans-serif;min-width:20px">${idx + 1}.</span>
    <span class="sev-dot" style="background:${riskColor}"></span>
    <span class="tag tag-${risk.risk_level || "medium"}">${RISK_LABELS[risk.risk_level] || risk.risk_level}</span>
    ${risk.department ? `<span class="tag tag-dept">${risk.department}</span>` : ""}
    ${risk.probability ? `<span style="font-size:8pt;color:#7f8c8d;font-family:'Segoe UI',sans-serif">Prob. ${risk.probability}%</span>` : ""}
  </div>
  <div class="item-title">${risk.title}</div>
  ${risk.description ? `<div class="item-desc">${risk.description}</div>` : ""}
  ${risk.recommended_action ? `
  <div class="item-action">
    <strong>Ação recomendada:</strong> ${risk.recommended_action}
  </div>` : ""}
</div>`;
}).join("")}
` : ""}

<!-- FOOTER -->
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
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
      <Printer className="h-4 w-4" />
      Relatório PDF
    </Button>
  );
}
