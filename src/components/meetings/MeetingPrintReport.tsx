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
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#16a34a",
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
  risco: "#dc2626",
  oportunidade: "#16a34a",
  decisao: "#2563eb",
  bloqueio: "#7c3aed",
  problema: "#f97316",
};

const INSIGHT_ICONS: Record<string, string> = {
  risco: "⚠",
  oportunidade: "🚀",
  decisao: "⚡",
  bloqueio: "🚧",
  problema: "🔴",
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
      key, label: INSIGHT_LABELS[key] || key, value, color: INSIGHT_COLORS[key] || "#6b7280",
    }));
  }, [insights]);

  const tasksByStatus = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.length - done - inProgress;
    return [
      { key: "done", label: "Concluídas", value: done, color: "#16a34a" },
      { key: "in_progress", label: "Em Andamento", value: inProgress, color: "#2563eb" },
      { key: "pending", label: "Pendentes", value: pending, color: "#eab308" },
    ].filter((d) => d.value > 0);
  }, [tasks]);

  const radarData = useMemo(() => {
    const totalInsights = insights.length || 1;
    const totalTasks = tasks.length || 1;
    const totalRisks = risks.length || 1;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const resolvedRisks = risks.filter((r) => r.status === "resolved").length;
    const highRisks = risks.filter((r) => r.risk_level === "critical" || r.risk_level === "high").length;

    return [
      { label: "Insights Gerados", value: Math.min(100, totalInsights * 20), icon: "💡" },
      { label: "Tarefas Concluídas", value: Math.round((completedTasks / totalTasks) * 100), icon: "✅" },
      { label: "Riscos Resolvidos", value: Math.round((resolvedRisks / totalRisks) * 100), icon: "🛡" },
      { label: "Controle de Severidade", value: Math.max(0, 100 - Math.round((highRisks / totalRisks) * 100)), icon: "📊" },
      { label: "Cobertura Analítica", value: insights.length > 0 && tasks.length > 0 && risks.length > 0 ? 100 : 50, icon: "🎯" },
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

    const maxRisksInDept = Math.max(...risksByDepartment.map(d => d.total), 1);
    const maxInsightCount = Math.max(...insightsByType.map(d => d.value), 1);
    const maxRiskLevel = Math.max(...risksByLevel.map(d => d.value), 1);

    const scoreColor = overallScore >= 75 ? "#16a34a" : overallScore >= 50 ? "#eab308" : "#dc2626";
    const scoreLabel = overallScore >= 75 ? "Excelente" : overallScore >= 50 ? "Moderado" : "Atenção";

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Executivo — ${meeting.title}</title>
<style>
  @page { size: A4; margin: 12mm 14mm; }
  @media print { .no-print { display: none !important; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1a1a2e; line-height: 1.55; background: #fff; font-size: 12px;
  }

  /* === HEADER === */
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #4338ca 100%);
    color: #fff; padding: 32px 36px; border-radius: 16px; margin-bottom: 24px;
    position: relative; overflow: hidden;
  }
  .header::before {
    content: ''; position: absolute; top: -40px; right: -40px;
    width: 200px; height: 200px; border-radius: 50%;
    background: rgba(255,255,255,0.04);
  }
  .header::after {
    content: ''; position: absolute; bottom: -60px; right: 60px;
    width: 160px; height: 160px; border-radius: 50%;
    background: rgba(255,255,255,0.03);
  }
  .header-brand { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.6; margin-bottom: 8px; font-weight: 600; }
  .header h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
  .header-sub { font-size: 13px; opacity: 0.75; font-weight: 400; }
  .header-meta { display: flex; gap: 28px; margin-top: 18px; flex-wrap: wrap; }
  .header-meta-item {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.1); padding: 6px 14px;
    border-radius: 8px; font-size: 11px; font-weight: 500; backdrop-filter: blur(4px);
  }

  /* === KPI === */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .kpi-card {
    border-radius: 14px; padding: 20px 16px; text-align: center;
    position: relative; overflow: hidden;
  }
  .kpi-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
  }
  .kpi-blue { background: #eff6ff; border: 1px solid #bfdbfe; }
  .kpi-blue::before { background: linear-gradient(90deg, #2563eb, #3b82f6); }
  .kpi-blue .kpi-value { color: #1d4ed8; }
  .kpi-green { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .kpi-green::before { background: linear-gradient(90deg, #16a34a, #22c55e); }
  .kpi-green .kpi-value { color: #15803d; }
  .kpi-orange { background: #fff7ed; border: 1px solid #fed7aa; }
  .kpi-orange::before { background: linear-gradient(90deg, #ea580c, #f97316); }
  .kpi-orange .kpi-value { color: #c2410c; }
  .kpi-red { background: #fef2f2; border: 1px solid #fecaca; }
  .kpi-red::before { background: linear-gradient(90deg, #dc2626, #ef4444); }
  .kpi-red .kpi-value { color: #b91c1c; }
  .kpi-icon { font-size: 22px; margin-bottom: 6px; }
  .kpi-value { font-size: 32px; font-weight: 900; line-height: 1; }
  .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; font-weight: 700; }

  /* === SECTIONS === */
  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .section-header {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; font-weight: 800; color: #0f172a;
    margin-bottom: 14px; padding-bottom: 8px;
    border-bottom: 2px solid #e2e8f0;
  }
  .section-header .icon {
    width: 28px; height: 28px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #fff; flex-shrink: 0;
  }
  .section-header .count {
    margin-left: auto; font-size: 11px; font-weight: 600;
    background: #f1f5f9; color: #475569; padding: 3px 10px; border-radius: 20px;
  }

  /* === CHARTS === */
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .chart-card {
    border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px;
    background: #fff;
  }
  .chart-title { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .bar-label { width: 90px; font-size: 11px; font-weight: 600; color: #475569; text-align: right; flex-shrink: 0; }
  .bar-track { flex: 1; height: 22px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative; }
  .bar-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; min-width: 28px; }
  .bar-fill span { font-size: 10px; font-weight: 800; color: #fff; }
  .bar-value { width: 28px; font-size: 12px; font-weight: 800; color: #0f172a; text-align: center; }

  /* === SCORE CARD === */
  .score-section { display: grid; grid-template-columns: 200px 1fr; gap: 24px; margin-bottom: 24px; align-items: start; }
  .score-ring {
    width: 160px; height: 160px; border-radius: 50%; position: relative;
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
  }
  .score-ring-inner {
    width: 120px; height: 120px; border-radius: 50%; background: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .score-number { font-size: 36px; font-weight: 900; line-height: 1; }
  .score-label-text { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .score-dim { margin-bottom: 12px; }
  .score-dim-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .score-dim-label { font-size: 11px; font-weight: 600; color: #334155; }
  .score-dim-value { font-size: 11px; font-weight: 800; color: #0f172a; }
  .score-dim-track { height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
  .score-dim-fill { height: 100%; border-radius: 4px; }

  /* === SUMMARY === */
  .summary-box {
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
    border-left: 4px solid; border-image: linear-gradient(180deg, #2563eb, #7c3aed) 1;
    border-radius: 0 14px 14px 0; padding: 20px 24px;
    font-size: 12px; line-height: 1.8; white-space: pre-wrap; color: #334155;
  }

  /* === ITEM CARDS === */
  .item-card {
    border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;
    margin-bottom: 10px; background: #fff; position: relative;
    border-left: 4px solid #e2e8f0; page-break-inside: avoid;
  }
  .item-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
  .item-card-title { font-size: 12px; font-weight: 700; color: #0f172a; flex: 1; }
  .item-card-desc { font-size: 11px; color: #64748b; line-height: 1.6; }
  .item-card-action { font-size: 11px; color: #475569; margin-top: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #6366f1; }
  .item-card-action em { font-style: normal; font-weight: 600; color: #4338ca; }

  /* === BADGES === */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 10px; border-radius: 20px; font-size: 9px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .badge-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .badge-high { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
  .badge-medium { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }
  .badge-low { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .badge-dept { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .badge-done { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .badge-in_progress { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .badge-pending { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }

  /* === DEPT TABLE === */
  .dept-table { width: 100%; border-collapse: separate; border-spacing: 0; }
  .dept-table th {
    text-align: left; font-size: 10px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 12px;
    border-bottom: 2px solid #e2e8f0; background: #f8fafc;
  }
  .dept-table th:first-child { border-radius: 8px 0 0 0; }
  .dept-table th:last-child { border-radius: 0 8px 0 0; }
  .dept-table td {
    padding: 10px 12px; font-size: 11px; color: #334155;
    border-bottom: 1px solid #f1f5f9;
  }
  .dept-table tr:last-child td { border-bottom: none; }
  .dept-bar-track { width: 100%; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
  .dept-bar-fill { height: 100%; border-radius: 3px; }

  /* === FOOTER === */
  .footer {
    margin-top: 32px; padding-top: 16px;
    border-top: 1px solid #e2e8f0; text-align: center; position: relative;
  }
  .footer-brand { font-size: 16px; font-weight: 900; color: #e2e8f0; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 6px; }
  .footer-info { font-size: 9px; color: #94a3b8; }
  .footer-line { display: flex; justify-content: center; gap: 20px; margin-top: 4px; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-brand">BI MASTER • RELATÓRIO EXECUTIVO</div>
  <h1>${meeting.title}</h1>
  <div class="header-sub">Análise Inteligente de Reunião com IA</div>
  <div class="header-meta">
    <div class="header-meta-item">📅 ${format(new Date(meeting.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
    <div class="header-meta-item">🕐 ${format(new Date(meeting.created_at), "HH:mm", { locale: ptBR })}</div>
    <div class="header-meta-item">⏱ ${durationText}</div>
    <div class="header-meta-item">📊 ${meeting.status === "analyzed" ? "✓ Analisada" : meeting.status}</div>
  </div>
</div>

<!-- KPIs -->
<div class="kpi-grid">
  <div class="kpi-card kpi-blue">
    <div class="kpi-icon">💡</div>
    <div class="kpi-value">${insights.length}</div>
    <div class="kpi-label">Insights</div>
  </div>
  <div class="kpi-card kpi-green">
    <div class="kpi-icon">✅</div>
    <div class="kpi-value">${tasks.length}</div>
    <div class="kpi-label">Tarefas</div>
  </div>
  <div class="kpi-card kpi-orange">
    <div class="kpi-icon">⚠️</div>
    <div class="kpi-value">${risks.length}</div>
    <div class="kpi-label">Riscos</div>
  </div>
  <div class="kpi-card kpi-red">
    <div class="kpi-icon">🎯</div>
    <div class="kpi-value">${tasks.filter((t) => t.status === "done").length}/${tasks.length}</div>
    <div class="kpi-label">Concluídas</div>
  </div>
</div>

<!-- CHARTS -->
<div class="charts-grid">
  <!-- Insights by Type -->
  <div class="chart-card">
    <div class="chart-title">📊 Distribuição de Insights</div>
    ${insightsByType.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(d.value / maxInsightCount) * 100}%; background: ${d.color};">
          <span>${d.value}</span>
        </div>
      </div>
    </div>`).join("")}
    ${insightsByType.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:11px;">Sem dados</div>' : ""}
  </div>

  <!-- Tasks by Status -->
  <div class="chart-card">
    <div class="chart-title">✅ Status de Tarefas</div>
    ${tasksByStatus.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${tasks.length > 0 ? (d.value / tasks.length) * 100 : 0}%; background: ${d.color};">
          <span>${d.value}</span>
        </div>
      </div>
    </div>`).join("")}
    ${tasksByStatus.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:11px;">Sem dados</div>' : ""}
  </div>

  <!-- Risks by Level -->
  <div class="chart-card">
    <div class="chart-title">⚠️ Riscos por Severidade</div>
    ${risksByLevel.filter(d => d.value > 0).map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(d.value / maxRiskLevel) * 100}%; background: ${d.color};">
          <span>${d.value}</span>
        </div>
      </div>
    </div>`).join("")}
    ${risksByLevel.every(d => d.value === 0) ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:11px;">Nenhum risco identificado</div>' : ""}
  </div>

  <!-- Risks by Department -->
  <div class="chart-card">
    <div class="chart-title">🏢 Riscos por Departamento</div>
    ${risksByDepartment.length > 0 ? `
    <table class="dept-table">
      <thead><tr><th>Departamento</th><th>Distribuição</th><th style="text-align:center">Total</th></tr></thead>
      <tbody>
      ${risksByDepartment.map(d => `
        <tr>
          <td style="font-weight:600">${d.department}</td>
          <td>
            <div class="dept-bar-track">
              <div class="dept-bar-fill" style="width:${(d.total / maxRisksInDept) * 100}%;background:linear-gradient(90deg,#f97316,#fb923c);"></div>
            </div>
          </td>
          <td style="text-align:center;font-weight:800;color:#ea580c">${d.total}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:11px;">Sem dados</div>'}
  </div>
</div>

<!-- PERFORMANCE SCORE -->
${(insights.length > 0 || tasks.length > 0 || risks.length > 0) ? `
<div class="section">
  <div class="section-header">
    <div class="icon" style="background:linear-gradient(135deg,#2563eb,#7c3aed)">🎯</div>
    Scorecard de Performance da Reunião
  </div>
  <div class="score-section">
    <div>
      <div class="score-ring" style="background: conic-gradient(${scoreColor} ${overallScore * 3.6}deg, #f1f5f9 ${overallScore * 3.6}deg);">
        <div class="score-ring-inner">
          <div class="score-number" style="color:${scoreColor}">${overallScore}</div>
          <div class="score-label-text" style="color:${scoreColor}">${scoreLabel}</div>
        </div>
      </div>
    </div>
    <div>
      ${radarData.map(d => {
        const barColor = d.value >= 75 ? "#16a34a" : d.value >= 50 ? "#eab308" : "#ef4444";
        return `
      <div class="score-dim">
        <div class="score-dim-header">
          <div class="score-dim-label">${d.icon} ${d.label}</div>
          <div class="score-dim-value">${d.value}%</div>
        </div>
        <div class="score-dim-track">
          <div class="score-dim-fill" style="width:${d.value}%;background:${barColor}"></div>
        </div>
      </div>`;
      }).join("")}
    </div>
  </div>
</div>` : ""}

<!-- SUMMARY -->
${meeting.summary ? `
<div class="section">
  <div class="section-header">
    <div class="icon" style="background:linear-gradient(135deg,#0f172a,#334155)">📝</div>
    Resumo Executivo
  </div>
  <div class="summary-box">${meeting.summary}</div>
</div>` : ""}

<!-- INSIGHTS -->
${insights.length > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="icon" style="background:linear-gradient(135deg,#2563eb,#6366f1)">💡</div>
    Insights Detalhados
    <div class="count">${insights.length} insights</div>
  </div>
  ${insights.map((ins: any) => {
    const borderColor = INSIGHT_COLORS[ins.insight_type] || "#6b7280";
    return `
  <div class="item-card" style="border-left-color:${borderColor}">
    <div class="item-card-header">
      <span style="font-size:14px">${INSIGHT_ICONS[ins.insight_type] || "💡"}</span>
      <span class="badge badge-${ins.impact_level || "medium"}">${INSIGHT_LABELS[ins.insight_type] || ins.insight_type}</span>
      ${ins.department ? `<span class="badge badge-dept">${ins.department}</span>` : ""}
      ${ins.impact_level ? `<span class="badge badge-${ins.impact_level}">Impacto ${PRIORITY_LABELS[ins.impact_level] || ins.impact_level}</span>` : ""}
    </div>
    <div class="item-card-title">${ins.title}</div>
    ${ins.description ? `<div class="item-card-desc">${ins.description}</div>` : ""}
  </div>`;
  }).join("")}
</div>` : ""}

<!-- TASKS -->
${tasks.length > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="icon" style="background:linear-gradient(135deg,#16a34a,#22c55e)">✅</div>
    Tarefas Identificadas
    <div class="count">${tasks.length} tarefas</div>
  </div>
  ${tasks.map((task: any) => {
    const statusColor = task.status === "done" ? "#16a34a" : task.status === "in_progress" ? "#2563eb" : "#eab308";
    return `
  <div class="item-card" style="border-left-color:${statusColor}">
    <div class="item-card-header">
      <span class="badge badge-${task.status || "pending"}">${TASK_STATUS_LABELS[task.status] || "Pendente"}</span>
      ${task.priority ? `<span class="badge badge-${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>` : ""}
      ${task.department ? `<span class="badge badge-dept">${task.department}</span>` : ""}
      ${task.assigned_to ? `<span style="font-size:10px;color:#64748b;margin-left:auto">👤 ${task.assigned_to}</span>` : ""}
    </div>
    <div class="item-card-title">${task.task}</div>
  </div>`;
  }).join("")}
</div>` : ""}

<!-- RISKS -->
${risks.length > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="icon" style="background:linear-gradient(135deg,#dc2626,#f97316)">⚠️</div>
    Riscos Identificados
    <div class="count">${risks.length} riscos</div>
  </div>
  ${risks.map((risk: any) => {
    const riskColor = RISK_COLORS[risk.risk_level] || "#eab308";
    return `
  <div class="item-card" style="border-left-color:${riskColor}">
    <div class="item-card-header">
      <span class="badge badge-${risk.risk_level || "medium"}">${RISK_LABELS[risk.risk_level] || risk.risk_level}</span>
      ${risk.department ? `<span class="badge badge-dept">${risk.department}</span>` : ""}
      ${risk.probability ? `<span style="font-size:10px;color:#64748b">Probabilidade: ${risk.probability}%</span>` : ""}
    </div>
    <div class="item-card-title">${risk.title}</div>
    ${risk.description ? `<div class="item-card-desc">${risk.description}</div>` : ""}
    ${risk.recommended_action ? `
    <div class="item-card-action">
      💡 <em>Ação recomendada:</em> ${risk.recommended_action}
    </div>` : ""}
  </div>`;
  }).join("")}
</div>` : ""}

<!-- FOOTER -->
<div class="footer">
  <div class="footer-brand">BI MASTER</div>
  <div class="footer-info">
    <div class="footer-line">
      <span>Relatório gerado automaticamente com Inteligência Artificial</span>
      <span>•</span>
      <span>${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</span>
    </div>
    <div style="margin-top:4px;color:#cbd5e1">Documento confidencial — uso interno</div>
  </div>
</div>

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
