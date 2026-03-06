import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
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
  low: "#22c55e",
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

const TASK_COLORS = {
  done: "#16a34a",
  in_progress: "#2563eb",
  pending: "#eab308",
};

export function MeetingPrintReport({ meeting, insights, tasks, risks }: MeetingPrintReportProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const risksByLevel = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach((r) => {
      counts[r.risk_level || "medium"] += 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: RISK_LABELS[key] || key,
        value,
        color: RISK_COLORS[key],
      }));
  }, [risks]);

  const risksByDepartment = useMemo(() => {
    const deptMap: Record<string, number> = {};
    risks.forEach((r) => {
      const dept = r.department || "Não definido";
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    return Object.entries(deptMap)
      .map(([dept, count]) => ({ department: dept, total: count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [risks]);

  const insightsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    insights.forEach((i) => {
      const t = i.insight_type || "outro";
      counts[t] = (counts[t] || 0) + 1;
    });
    const colors = ["#2563eb", "#f97316", "#22c55e", "#8b5cf6", "#ec4899"];
    return Object.entries(counts).map(([key, value], i) => ({
      name: INSIGHT_LABELS[key] || key,
      value,
      color: colors[i % colors.length],
    }));
  }, [insights]);

  const tasksByStatus = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.length - done - inProgress;
    return [
      { name: "Concluídas", value: done, color: TASK_COLORS.done },
      { name: "Em andamento", value: inProgress, color: TASK_COLORS.in_progress },
      { name: "Pendentes", value: pending, color: TASK_COLORS.pending },
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
      { dimension: "Insights", value: Math.min(100, totalInsights * 20), fullMark: 100 },
      { dimension: "Tarefas", value: Math.round((completedTasks / totalTasks) * 100), fullMark: 100 },
      { dimension: "Riscos Resolvidos", value: Math.round((resolvedRisks / totalRisks) * 100), fullMark: 100 },
      { dimension: "Severidade", value: Math.max(0, 100 - Math.round((highRisks / totalRisks) * 100)), fullMark: 100 },
      { dimension: "Cobertura", value: insights.length > 0 && tasks.length > 0 && risks.length > 0 ? 100 : 50, fullMark: 100 },
    ];
  }, [insights, tasks, risks]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Clone SVGs from recharts for proper rendering
    const clone = content.cloneNode(true) as HTMLElement;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Executivo - ${meeting.title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; line-height: 1.5; background: white; }
          .report-header { background: linear-gradient(135deg, #1e40af, #7c3aed); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; }
          .report-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .report-header p { font-size: 12px; opacity: 0.85; }
          .report-header .meta { display: flex; gap: 24px; margin-top: 12px; font-size: 11px; opacity: 0.9; }
          .section { margin-bottom: 20px; page-break-inside: avoid; }
          .section-title { font-size: 14px; font-weight: 700; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
          .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .kpi-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-align: center; }
          .kpi-card .value { font-size: 26px; font-weight: 800; color: #1e40af; }
          .kpi-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
          .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .chart-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
          .chart-box h4 { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 10px; }
          .chart-container { width: 100%; height: 200px; }
          .item-list { list-style: none; }
          .item-list li { padding: 8px 12px; border-left: 3px solid #e5e7eb; margin-bottom: 6px; background: #f9fafb; border-radius: 0 6px 6px 0; font-size: 12px; }
          .item-list li.risk-critical { border-left-color: #dc2626; }
          .item-list li.risk-high { border-left-color: #f97316; }
          .item-list li.risk-medium { border-left-color: #eab308; }
          .item-list li.risk-low { border-left-color: #22c55e; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; margin-right: 6px; }
          .badge-critical { background: #fef2f2; color: #dc2626; }
          .badge-high { background: #fff7ed; color: #ea580c; }
          .badge-medium { background: #fefce8; color: #ca8a04; }
          .badge-low { background: #f0fdf4; color: #16a34a; }
          .badge-dept { background: #eff6ff; color: #2563eb; }
          .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; font-size: 12px; white-space: pre-wrap; line-height: 1.7; }
          .footer { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        ${clone.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();

    // Wait for SVG rendering then print
    setTimeout(() => {
      printWindow.print();
    }, 800);
  };

  const durationText = meeting.duration_seconds
    ? `${Math.floor(meeting.duration_seconds / 60)}min ${meeting.duration_seconds % 60}s`
    : "N/A";

  return (
    <>
      <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
        <Printer className="h-4 w-4" />
        Relatório PDF
      </Button>

      {/* Hidden printable content */}
      <div ref={printRef} className="hidden">
        {/* Header */}
        <div className="report-header">
          <h1>{meeting.title}</h1>
          <p>Relatório Executivo de Análise de Reunião</p>
          <div className="meta">
            <span>📅 {format(new Date(meeting.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</span>
            <span>⏱ Duração: {durationText}</span>
            <span>📊 Status: {meeting.status === "analyzed" ? "Analisada" : meeting.status}</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="value">{insights.length}</div>
            <div className="label">Insights</div>
          </div>
          <div className="kpi-card">
            <div className="value">{tasks.length}</div>
            <div className="label">Tarefas</div>
          </div>
          <div className="kpi-card">
            <div className="value">{risks.length}</div>
            <div className="label">Riscos</div>
          </div>
          <div className="kpi-card">
            <div className="value">{tasks.filter((t) => t.status === "done").length}</div>
            <div className="label">Tarefas Concluídas</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="charts-grid">
          {/* Insights by Type */}
          <div className="chart-box">
            <h4>📊 Distribuição de Insights</h4>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={insightsByType} cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {insightsByType.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tasks by Status */}
          <div className="chart-box">
            <h4>✅ Status de Tarefas</h4>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tasksByStatus} cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {tasksByStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risks by Level */}
          <div className="chart-box">
            <h4>⚠️ Riscos por Severidade</h4>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={risksByLevel} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Quantidade" radius={[0, 6, 6, 0]} barSize={22}>
                    {risksByLevel.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risks by Department */}
          <div className="chart-box">
            <h4>🏢 Riscos por Departamento</h4>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={risksByDepartment} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="department" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total de Riscos" fill="#f97316" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Radar Performance */}
        {(insights.length > 0 || tasks.length > 0 || risks.length > 0) && (
          <div className="section">
            <div className="section-title">Radar de Performance da Reunião</div>
            <div style={{ width: "100%", height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                  <Radar name="Performance" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Summary */}
        {meeting.summary && (
          <div className="section">
            <div className="section-title">Resumo Executivo</div>
            <div className="summary-box">{meeting.summary}</div>
          </div>
        )}

        {/* Detailed Insights */}
        {insights.length > 0 && (
          <div className="section">
            <div className="section-title">Insights Detalhados ({insights.length})</div>
            <ul className="item-list">
              {insights.map((insight: any) => (
                <li key={insight.id}>
                  <span className={`badge badge-${insight.impact_level || "medium"}`}>
                    {INSIGHT_LABELS[insight.insight_type] || insight.insight_type}
                  </span>
                  {insight.department && <span className="badge badge-dept">{insight.department}</span>}
                  <strong>{insight.title}</strong>
                  {insight.description && <span> — {insight.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Tasks */}
        {tasks.length > 0 && (
          <div className="section">
            <div className="section-title">Tarefas Identificadas ({tasks.length})</div>
            <ul className="item-list">
              {tasks.map((task: any) => (
                <li key={task.id}>
                  <span className={`badge badge-${task.priority || "medium"}`}>{task.priority}</span>
                  {task.department && <span className="badge badge-dept">{task.department}</span>}
                  <strong>{task.task}</strong>
                  <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280" }}>
                    [{task.status === "done" ? "Concluída" : task.status === "in_progress" ? "Em andamento" : "Pendente"}]
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Risks */}
        {risks.length > 0 && (
          <div className="section">
            <div className="section-title">Riscos Identificados ({risks.length})</div>
            <ul className="item-list">
              {risks.map((risk: any) => (
                <li key={risk.id} className={`risk-${risk.risk_level || "medium"}`}>
                  <span className={`badge badge-${risk.risk_level || "medium"}`}>
                    {RISK_LABELS[risk.risk_level] || risk.risk_level}
                  </span>
                  {risk.department && <span className="badge badge-dept">{risk.department}</span>}
                  <strong>{risk.title}</strong>
                  {risk.description && <span> — {risk.description}</span>}
                  {risk.recommended_action && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#4b5563" }}>
                      💡 <em>Ação recomendada: {risk.recommended_action}</em>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="footer">
          Relatório gerado automaticamente por BI Master • {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </div>
      </div>
    </>
  );
}
