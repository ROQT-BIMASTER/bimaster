import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, Calendar, AlertTriangle, ListTodo,
  Brain, Clock, PieChart as PieChartIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
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

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(220, 14%, 60%)",
];

const RISK_COLORS: Record<string, string> = {
  high: "hsl(0, 84%, 60%)",
  critical: "hsl(0, 84%, 40%)",
  medium: "hsl(38, 92%, 50%)",
  low: "hsl(142, 76%, 36%)",
};

export function MeetingExecutiveDashboard({ meetings, risks, tasks }: MeetingExecutiveDashboardProps) {
  const [expanded, setExpanded] = useState(true);

  // === Computed Data ===

  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date(),
    });

    return months.map((month) => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const inRange = meetings.filter((m) => {
        const d = parseISO(m.created_at);
        return d >= start && d <= end;
      });

      return {
        month: format(month, "MMM", { locale: ptBR }),
        fullMonth: format(month, "MMMM yyyy", { locale: ptBR }),
        total: inRange.length,
        analisadas: inRange.filter((m) => m.status === "analyzed").length,
        pendentes: inRange.filter((m) => m.status !== "analyzed").length,
        duracao: Math.round(
          inRange.reduce((acc, m) => acc + (m.duration_seconds || 0), 0) / 60
        ),
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
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [meetings]);

  const risksByLevel = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach((r) => {
      const level = r.risk_level || "medium";
      counts[level] = (counts[level] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === "critical" ? "Crítico" : name === "high" ? "Alto" : name === "medium" ? "Médio" : "Baixo",
        value,
        color: RISK_COLORS[name],
      }));
  }, [risks]);

  const tasksByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      const label = t.status === "done" ? "Concluídas" : t.status === "in_progress" ? "Em andamento" : "Pendentes";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const avgDuration = useMemo(() => {
    const withDuration = meetings.filter((m) => m.duration_seconds && m.duration_seconds > 0);
    if (!withDuration.length) return 0;
    return Math.round(withDuration.reduce((a, m) => a + (m.duration_seconds || 0), 0) / withDuration.length / 60);
  }, [meetings]);

  const recentWeekCount = useMemo(() => {
    const weekAgo = subDays(new Date(), 7);
    return meetings.filter((m) => parseISO(m.created_at) >= weekAgo).length;
  }, [meetings]);

  const openRisks = risks.filter((r) => r.status !== "resolved").length;
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;

  if (!meetings.length) return null;

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors pb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Relatório Executivo</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visão consolidada das reuniões e indicadores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini KPIs inline */}
            <div className="hidden md:flex items-center gap-4 mr-4">
              <div className="text-right">
                <p className="text-lg font-bold text-foreground leading-none">{recentWeekCount}</p>
                <p className="text-[10px] text-muted-foreground">últimos 7 dias</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-right">
                <p className="text-lg font-bold text-foreground leading-none">{avgDuration}min</p>
                <p className="text-[10px] text-muted-foreground">duração média</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-right">
                <p className="text-lg font-bold text-orange-500 leading-none">{openRisks}</p>
                <p className="text-[10px] text-muted-foreground">riscos abertos</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Row 1: Timeline chart */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Reuniões por Mês</h3>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAnalisadas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPendentes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => {
                      const item = monthlyData.find((d) => d.month === label);
                      return item?.fullMonth || label;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="analisadas"
                    name="Analisadas"
                    stroke="hsl(var(--primary))"
                    fill="url(#gradAnalisadas)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="pendentes"
                    name="Pendentes"
                    stroke="hsl(38, 92%, 50%)"
                    fill="url(#gradPendentes)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Pie charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status distribution */}
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-semibold text-foreground">Status</h4>
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {statusDistribution.map((d, i) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name} ({d.value})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risks by level */}
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <h4 className="text-xs font-semibold text-foreground">Riscos por Nível</h4>
                </div>
                {risksByLevel.length > 0 ? (
                  <>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={risksByLevel} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                          <Bar dataKey="value" name="Qtd" radius={[4, 4, 0, 0]}>
                            {risksByLevel.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground mt-1">
                      {openRisks} risco{openRisks !== 1 ? "s" : ""} em aberto
                    </p>
                  </>
                ) : (
                  <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
                    Nenhum risco registrado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tasks by status */}
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <ListTodo className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold text-foreground">Tarefas</h4>
                </div>
                {tasksByStatus.length > 0 ? (
                  <>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tasksByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={55}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {tasksByStatus.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {tasksByStatus.map((d, i) => (
                        <Badge key={d.name} variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {d.name} ({d.value})
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
                    Nenhuma tarefa registrada
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Duration chart */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Tempo Total em Reuniões (min)</h3>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => {
                      const item = monthlyData.find((d) => d.month === label);
                      return item?.fullMonth || label;
                    }}
                    formatter={(value: number) => [`${value} min`, "Duração"]}
                  />
                  <Bar dataKey="duracao" name="Duração (min)" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
