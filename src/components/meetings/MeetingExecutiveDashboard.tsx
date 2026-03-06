import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, Calendar, AlertTriangle, ListTodo,
  Brain, Clock, PieChart as PieChartIcon, ChevronDown, ChevronUp,
  Zap, Target, Activity, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart, Line,
  RadialBarChart, RadialBar,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Meeting {
  id: string;
  title: string;
  status: string;
  created_at: string;
  duration_seconds: number | null;
  meeting_date: string;
  meeting_risks?: { count: number }[];
  meeting_tasks?: { count: number }[];
  meeting_insights?: { count: number }[];
}

interface MeetingExecutiveDashboardProps {
  meetings: Meeting[];
  risks: any[];
  tasks: any[];
}

const STATUS_COLORS: Record<string, string> = {
  "Analisadas": "hsl(152, 76%, 36%)",
  "Rascunho": "hsl(220, 14%, 60%)",
  "Gravando": "hsl(0, 84%, 60%)",
  "Processando": "hsl(38, 92%, 50%)",
  "Erro": "hsl(0, 60%, 50%)",
  "Outro": "hsl(220, 14%, 70%)",
};

const TASK_COLORS: Record<string, string> = {
  "Concluídas": "hsl(152, 76%, 36%)",
  "Em andamento": "hsl(221, 83%, 53%)",
  "Pendentes": "hsl(38, 92%, 50%)",
};

const RISK_COLORS: Record<string, string> = {
  high: "hsl(0, 84%, 60%)",
  critical: "hsl(0, 72%, 45%)",
  medium: "hsl(38, 92%, 50%)",
  low: "hsl(152, 76%, 36%)",
};

const CustomTooltip = ({ active, payload, label, labelFormatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <p className="text-xs font-semibold text-foreground mb-1.5">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-accent/[0.02] pointer-events-none" />
    <div className="relative">{children}</div>
  </div>
);

const KpiCard = ({ icon: Icon, label, value, trend, color }: {
  icon: any; label: string; value: string | number; trend?: string; color: string;
}) => (
  <GlassCard className="p-4">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        {trend && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
            <span className="text-[10px] font-medium text-[hsl(var(--success))]">{trend}</span>
          </div>
        )}
      </div>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
    </div>
  </GlassCard>
);

export function MeetingExecutiveDashboard({ meetings, risks, tasks }: MeetingExecutiveDashboardProps) {
  const [expanded, setExpanded] = useState(true);

  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() });
    return months.map((month) => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const inRange = meetings.filter((m) => { const d = parseISO(m.created_at); return d >= start && d <= end; });
      const total = inRange.length;
      const analisadas = inRange.filter((m) => m.status === "analyzed").length;
      return {
        month: format(month, "MMM", { locale: ptBR }),
        fullMonth: format(month, "MMMM yyyy", { locale: ptBR }),
        total,
        analisadas,
        pendentes: total - analisadas,
        duracao: Math.round(inRange.reduce((acc, m) => acc + (m.duration_seconds || 0), 0) / 60),
        taxa: total > 0 ? Math.round((analisadas / total) * 100) : 0,
      };
    });
  }, [meetings]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => {
      const label =
        m.status === "analyzed" ? "Analisadas" :
        m.status === "draft" ? "Rascunho" :
        m.status === "recording" ? "Gravando" :
        m.status === "processing" || m.status === "transcribing" ? "Processando" :
        m.status === "error" ? "Erro" : "Outro";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name, value, color: STATUS_COLORS[name] || "hsl(220, 14%, 60%)",
    }));
  }, [meetings]);

  const risksByLevel = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach((r) => { counts[r.risk_level || "medium"] = (counts[r.risk_level || "medium"] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === "critical" ? "Crítico" : name === "high" ? "Alto" : name === "medium" ? "Médio" : "Baixo",
        value, color: RISK_COLORS[name], key: name,
      }));
  }, [risks]);

  // Risks grouped by department with severity breakdown
  const risksByDepartment = useMemo(() => {
    const deptMap: Record<string, { critical: number; high: number; medium: number; low: number; total: number }> = {};
    risks.forEach((r) => {
      const dept = r.department || "Não definido";
      if (!deptMap[dept]) deptMap[dept] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      const level = r.risk_level || "medium";
      deptMap[dept][level as keyof typeof deptMap[string]] = (deptMap[dept][level as keyof typeof deptMap[string]] as number) + 1;
      deptMap[dept].total += 1;
    });
    return Object.entries(deptMap)
      .map(([dept, counts]) => ({ department: dept, ...counts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [risks]);

  const tasksByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      const label = t.status === "done" ? "Concluídas" : t.status === "in_progress" ? "Em andamento" : "Pendentes";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name, value, color: TASK_COLORS[name] || "hsl(220, 14%, 60%)",
    }));
  }, [tasks]);

  // Radar chart data: performance dimensions
  const radarData = useMemo(() => {
    const totalMeetings = meetings.length || 1;
    const analyzed = meetings.filter(m => m.status === "analyzed").length;
    const withDuration = meetings.filter(m => m.duration_seconds && m.duration_seconds > 0);
    const avgDur = withDuration.length ? withDuration.reduce((a, m) => a + (m.duration_seconds || 0), 0) / withDuration.length / 60 : 0;
    const completedTasks = tasks.filter(t => t.status === "done").length;
    const totalTasks = tasks.length || 1;
    const resolvedRisks = risks.filter(r => r.status === "resolved").length;
    const totalRisks = risks.length || 1;

    return [
      { dimension: "Análise", value: Math.round((analyzed / totalMeetings) * 100), fullMark: 100 },
      { dimension: "Produtividade", value: Math.min(100, Math.round(avgDur > 0 ? Math.min(avgDur / 60, 1) * 100 : 50)), fullMark: 100 },
      { dimension: "Tarefas", value: Math.round((completedTasks / totalTasks) * 100), fullMark: 100 },
      { dimension: "Riscos", value: Math.round((resolvedRisks / totalRisks) * 100), fullMark: 100 },
      { dimension: "Volume", value: Math.min(100, totalMeetings * 10), fullMark: 100 },
      { dimension: "Insights", value: Math.min(100, meetings.reduce((a, m) => a + (m.meeting_insights?.[0]?.count || 0), 0) * 15), fullMark: 100 },
    ];
  }, [meetings, tasks, risks]);

  // Radial bar for task completion
  const taskCompletionData = useMemo(() => {
    const total = tasks.length || 1;
    const done = tasks.filter(t => t.status === "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    return [
      { name: "Concluídas", value: Math.round((done / total) * 100), fill: "hsl(152, 76%, 36%)" },
      { name: "Em andamento", value: Math.round((inProgress / total) * 100), fill: "hsl(221, 83%, 53%)" },
    ];
  }, [tasks]);

  const avgDuration = useMemo(() => {
    const wd = meetings.filter((m) => m.duration_seconds && m.duration_seconds > 0);
    if (!wd.length) return 0;
    return Math.round(wd.reduce((a, m) => a + (m.duration_seconds || 0), 0) / wd.length / 60);
  }, [meetings]);

  const recentWeekCount = useMemo(() => {
    const weekAgo = subDays(new Date(), 7);
    return meetings.filter((m) => parseISO(m.created_at) >= weekAgo).length;
  }, [meetings]);

  const openRisks = risks.filter((r) => r.status !== "resolved").length;
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;
  const completionRate = meetings.length ? Math.round((meetings.filter(m => m.status === "analyzed").length / meetings.length) * 100) : 0;

  if (!meetings.length) return null;

  return (
    <Card className="border-primary/20 overflow-hidden bg-gradient-to-br from-card to-card/95">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-all duration-300 pb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Relatório Executivo</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visão consolidada de performance e indicadores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 mr-4">
              <div className="text-right">
                <p className="text-lg font-bold text-foreground leading-none">{recentWeekCount}</p>
                <p className="text-[10px] text-muted-foreground">últimos 7 dias</p>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div className="text-right">
                <p className="text-lg font-bold text-foreground leading-none">{avgDuration}min</p>
                <p className="text-[10px] text-muted-foreground">duração média</p>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div className="text-right">
                <p className="text-lg font-bold leading-none" style={{ color: "hsl(38, 92%, 50%)" }}>{openRisks}</p>
                <p className="text-[10px] text-muted-foreground">riscos abertos</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-6 pb-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Activity} label="Total Reuniões" value={meetings.length} color="hsl(221, 83%, 53%)" />
            <KpiCard icon={Target} label="Taxa Análise" value={`${completionRate}%`} color="hsl(152, 76%, 36%)" />
            <KpiCard icon={Flame} label="Riscos Abertos" value={openRisks} color="hsl(38, 92%, 50%)" />
            <KpiCard icon={Zap} label="Tarefas Pendentes" value={pendingTasks} color="hsl(262, 83%, 58%)" />
          </div>

          {/* Row 1: Combined volume + rate chart */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Evolução Mensal</h3>
              <Badge variant="outline" className="ml-auto text-[10px]">Últimos 6 meses</Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradAnalyzed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152, 76%, 36%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(152, 76%, 36%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip labelFormatter={(l: string) => monthlyData.find(d => d.month === l)?.fullMonth || l} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="left" type="monotone" dataKey="total" name="Total" stroke="hsl(221, 83%, 53%)" fill="url(#gradTotal)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(221, 83%, 53%)", strokeWidth: 2, stroke: "white" }} />
                  <Area yAxisId="left" type="monotone" dataKey="analisadas" name="Analisadas" stroke="hsl(152, 76%, 36%)" fill="url(#gradAnalyzed)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(152, 76%, 36%)", strokeWidth: 2, stroke: "white" }} />
                  <Line yAxisId="right" type="monotone" dataKey="taxa" name="Taxa de Análise (%)" stroke="hsl(262, 83%, 58%)" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: "hsl(262, 83%, 58%)" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Row 2: 3 columns - Status + Risks + Radar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Donut */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-foreground">Distribuição de Status</h4>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {statusDistribution.map((entry, i) => (
                        <linearGradient key={i} id={`statusGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                      cornerRadius={4}
                    >
                      {statusDistribution.map((_, i) => (
                        <Cell key={i} fill={`url(#statusGrad${i})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    {/* Center label */}
                    <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-lg font-bold">{meetings.length}</text>
                    <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-[9px]">reuniões</text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {statusDistribution.map((d) => (
                  <Badge key={d.name} variant="outline" className="text-[10px] gap-1 px-1.5 py-0 border-border/50">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name} ({d.value})
                  </Badge>
                ))}
              </div>
            </GlassCard>

            {/* Risks Horizontal Bar */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" style={{ color: "hsl(38, 92%, 50%)" }} />
                <h4 className="text-xs font-semibold text-foreground">Mapa de Riscos</h4>
              </div>
              {risksByLevel.length > 0 ? (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={risksByLevel} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} width={50} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Quantidade" radius={[0, 8, 8, 0]} barSize={20}>
                          {risksByLevel.map((entry, i) => (
                            <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground mt-1">
                    <span className="font-semibold" style={{ color: "hsl(38, 92%, 50%)" }}>{openRisks}</span> risco{openRisks !== 1 ? "s" : ""} em aberto
                  </p>
                </>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
                  <span className="text-xs">Nenhum risco registrado</span>
                </div>
              )}
            </GlassCard>

            {/* Radar Performance */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-accent" />
                <h4 className="text-xs font-semibold text-foreground">Radar de Performance</h4>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(220, 13%, 91%)" strokeOpacity={0.6} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: "hsl(220, 9%, 46%)" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Performance"
                      dataKey="value"
                      stroke="hsl(221, 83%, 53%)"
                      fill="hsl(221, 83%, 53%)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(221, 83%, 53%)" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-[10px] text-muted-foreground mt-1">
                Score geral baseado em 6 dimensões
              </p>
            </GlassCard>
          </div>

          {/* Row 3: Duration + Tasks */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Duration - 3 cols */}
            <GlassCard className="p-5 md:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Investimento de Tempo</h3>
                <Badge variant="outline" className="ml-auto text-[10px]">minutos/mês</Badge>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradDuracao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={<CustomTooltip labelFormatter={(l: string) => monthlyData.find(d => d.month === l)?.fullMonth || l} />}
                    />
                    <Bar dataKey="duracao" name="Duração (min)" fill="url(#gradDuracao)" radius={[8, 8, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Task Radial + Summary - 2 cols */}
            <GlassCard className="p-4 md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <ListTodo className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground">Progresso de Tarefas</h4>
              </div>
              {tasksByStatus.length > 0 ? (
                <>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {tasksByStatus.map((entry, i) => (
                            <linearGradient key={i} id={`taskGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={tasksByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                          cornerRadius={4}
                        >
                          {tasksByStatus.map((_, i) => (
                            <Cell key={i} fill={`url(#taskGrad${i})`} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-lg font-bold">{tasks.length}</text>
                        <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-[9px]">tarefas</text>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {tasksByStatus.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-muted-foreground">
                  <ListTodo className="h-8 w-8 mb-2 opacity-20" />
                  <span className="text-xs">Nenhuma tarefa registrada</span>
                </div>
              )}
            </GlassCard>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
