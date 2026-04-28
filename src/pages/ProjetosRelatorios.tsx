import { useState, useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  CalendarRange,
  TrendingUp,
  AlertTriangle,
  Users,
  Crown,
  Brain,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { format, subDays, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const REPORTS = [
  { key: "status_semanal", label: "Status semanal", icon: CalendarRange, group: "operacional" },
  { key: "burndown", label: "Burndown", icon: TrendingUp, group: "operacional" },
  { key: "atrasos", label: "Atrasos", icon: AlertTriangle, group: "operacional" },
  { key: "produtividade", label: "Produtividade da equipe", icon: Users, group: "operacional" },
  { key: "executivo", label: "Dashboard C-Level", icon: Crown, group: "executivo" },
  { key: "preditivo", label: "Análise preditiva (IA)", icon: Brain, group: "executivo" },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];

export default function ProjetosRelatorios() {
  const [active, setActive] = useState<ReportKey>("status_semanal");
  const [periodo, setPeriodo] = useState<"7" | "14" | "30" | "90">("30");
  const [projetoFiltro, setProjetoFiltro] = useState<string>("all");
  const { projetos } = useProjetos();
  const { getProjectSummary, loading: iaLoading } = useProjetoIA();
  const [iaSummary, setIaSummary] = useState<string>("");
  const { bgColor, setBgColor } = usePageBgColor("projetos_relatorios");

  const dataInicio = useMemo(
    () => subDays(new Date(), parseInt(periodo)),
    [periodo],
  );

  // Carregar todas as tarefas do(s) projeto(s) no período
  const { data: tarefasGlobal = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["relatorios-tarefas", periodo, projetoFiltro],
    queryFn: async () => {
      let q = supabase
        .from("projeto_tarefas" as any)
        .select("id, projeto_id, secao_id, titulo, status, prioridade, responsavel_id, data_prazo, created_at, updated_at")
        .gte("created_at", dataInicio.toISOString());
      if (projetoFiltro !== "all") q = q.eq("projeto_id", projetoFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Carregar todas as metas
  const { data: metasGlobal = [] } = useQuery({
    queryKey: ["relatorios-metas", projetoFiltro],
    queryFn: async () => {
      let q = supabase.from("projeto_metas" as any).select("*");
      if (projetoFiltro !== "all") q = q.eq("projeto_id", projetoFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // ===== Métricas =====
  const totalTarefas = tarefasGlobal.length;
  const concluidas = tarefasGlobal.filter((t) => t.status === "concluida").length;
  const atrasadas = tarefasGlobal.filter(
    (t) => t.data_prazo && new Date(t.data_prazo) < new Date() && t.status !== "concluida",
  ).length;
  const semResponsavel = tarefasGlobal.filter((t) => !t.responsavel_id).length;
  const altaPrioridade = tarefasGlobal.filter((t) => t.prioridade === "alta" || t.prioridade === "urgente").length;
  const taxaConclusao = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

  // Burndown global
  const burndownData = useMemo(() => {
    const dias = parseInt(periodo);
    return Array.from({ length: dias }).map((_, i) => {
      const dia = subDays(new Date(), dias - 1 - i);
      const concluidasAteDia = tarefasGlobal.filter(
        (t) => t.status === "concluida" && t.updated_at && new Date(t.updated_at) <= dia,
      ).length;
      const ideal = Math.max(0, Math.round(totalTarefas - (totalTarefas / Math.max(dias - 1, 1)) * i));
      return {
        dia: format(dia, "dd/MM"),
        Restantes: totalTarefas - concluidasAteDia,
        Ideal: ideal,
      };
    });
  }, [tarefasGlobal, periodo, totalTarefas]);

  // Produtividade por responsável
  const produtividade = useMemo(() => {
    const grupos = new Map<string, { concluidas: number; total: number }>();
    tarefasGlobal.forEach((t) => {
      const k = t.responsavel_id || "(sem responsável)";
      const g = grupos.get(k) || { concluidas: 0, total: 0 };
      g.total++;
      if (t.status === "concluida") g.concluidas++;
      grupos.set(k, g);
    });
    return Array.from(grupos.entries()).slice(0, 10).map(([k, g]) => ({
      responsavel: k.length > 12 ? k.slice(0, 8) + "…" : k,
      Concluídas: g.concluidas,
      Total: g.total,
    }));
  }, [tarefasGlobal]);

  // Distribuição por status
  const statusDist = useMemo(() => {
    const grupos: Record<string, number> = {};
    tarefasGlobal.forEach((t) => {
      grupos[t.status || "pendente"] = (grupos[t.status || "pendente"] || 0) + 1;
    });
    return Object.entries(grupos).map(([k, v]) => ({ name: k, value: v }));
  }, [tarefasGlobal]);

  // Atrasos por motivo (proxy: por prioridade)
  const atrasosPorPrioridade = useMemo(() => {
    const grupos: Record<string, number> = {};
    tarefasGlobal
      .filter((t) => t.data_prazo && new Date(t.data_prazo) < new Date() && t.status !== "concluida")
      .forEach((t) => {
        const k = t.prioridade || "media";
        grupos[k] = (grupos[k] || 0) + 1;
      });
    return Object.entries(grupos).map(([k, v]) => ({ prioridade: k, atrasadas: v }));
  }, [tarefasGlobal]);

  // Score executivo: ponderado entre conclusão, atrasos e metas
  const scoreExecutivo = useMemo(() => {
    const pesoConclusao = taxaConclusao;
    const pesoAtrasos = atrasadas > 0 && totalTarefas > 0 ? Math.round(100 - (atrasadas / totalTarefas) * 100) : 100;
    const pesoMetas =
      metasGlobal.length > 0
        ? Math.round(
            metasGlobal.reduce(
              (s: number, m: any) => s + Math.min(100, (m.valor_atual / Math.max(m.valor_alvo, 1)) * 100),
              0,
            ) / metasGlobal.length,
          )
        : 100;
    return Math.round((pesoConclusao + pesoAtrasos + pesoMetas) / 3);
  }, [taxaConclusao, atrasadas, totalTarefas, metasGlobal]);

  // Forecast preditivo: dias estimados para concluir restantes
  const forecast = useMemo(() => {
    const restantes = totalTarefas - concluidas;
    const dias = parseInt(periodo);
    const ritmoDia = concluidas / Math.max(dias, 1);
    const diasParaConcluir = ritmoDia > 0 ? Math.ceil(restantes / ritmoDia) : null;
    const dataPrev = diasParaConcluir
      ? format(new Date(Date.now() + diasParaConcluir * 86400000), "dd 'de' MMMM", { locale: ptBR })
      : "—";
    return { ritmoDia: ritmoDia.toFixed(1), diasParaConcluir, dataPrev };
  }, [totalTarefas, concluidas, periodo]);

  const gerarResumoIA = async () => {
    if (projetoFiltro === "all") {
      toast.info("Selecione um projeto específico para gerar o resumo IA");
      return;
    }
    const r = await getProjectSummary(projetoFiltro);
    setIaSummary(r.summary);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    const titulo = REPORTS.find((r) => r.key === active)?.label || "Relatório";
    doc.setFontSize(18);
    doc.text(titulo, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Período: últimos ${periodo} dias  •  Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    doc.setTextColor(0);
    doc.setFontSize(11);

    let y = 42;
    const linha = (label: string, value: string | number) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 90, y);
      y += 7;
    };

    linha("Total de tarefas:", totalTarefas);
    linha("Concluídas:", `${concluidas} (${taxaConclusao}%)`);
    linha("Atrasadas:", atrasadas);
    linha("Sem responsável:", semResponsavel);
    linha("Alta prioridade:", altaPrioridade);
    linha("Score executivo:", `${scoreExecutivo}/100`);
    linha("Total de metas:", metasGlobal.length);

    if (active === "preditivo") {
      y += 4;
      linha("Ritmo médio (tarefas/dia):", forecast.ritmoDia);
      linha("Dias estimados para concluir restantes:", forecast.diasParaConcluir ?? "—");
      linha("Previsão de conclusão:", forecast.dataPrev);
    }

    if (iaSummary) {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Resumo IA:", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const split = doc.splitTextToSize(iaSummary, 180);
      doc.text(split, 14, y);
    }

    doc.save(`${active}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exportado");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Relatórios de Projetos</h1>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Projeto:</span>
                  <Select value={projetoFiltro} onValueChange={setProjetoFiltro}>
                    <SelectTrigger className="w-[260px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      {projetos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Período:</span>
                  <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="14">Últimos 14 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={gerarResumoIA} disabled={iaLoading === "project_summary"}>
                    {iaLoading === "project_summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    Resumo IA
                  </Button>
                  <Button size="sm" onClick={exportarPDF}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KPIs sempre visíveis */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <KpiCard label="Total" value={totalTarefas} />
              <KpiCard label="Concluídas" value={concluidas} sub={`${taxaConclusao}%`} accent="text-emerald-500" />
              <KpiCard label="Atrasadas" value={atrasadas} accent="text-destructive" />
              <KpiCard label="Sem resp." value={semResponsavel} accent="text-amber-500" />
              <KpiCard label="Alta prioridade" value={altaPrioridade} accent="text-violet-500" />
              <KpiCard label="Score" value={`${scoreExecutivo}`} sub="/ 100" accent="text-primary" />
            </div>

            {/* Tabs */}
            <Tabs value={active} onValueChange={(v) => setActive(v as ReportKey)}>
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto">
                {REPORTS.map((r) => {
                  const Icon = r.icon;
                  return (
                    <TabsTrigger key={r.key} value={r.key} className="flex flex-col gap-0.5 py-2 text-[11px]">
                      <Icon className="h-4 w-4" />
                      {r.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Status semanal */}
              <TabsContent value="status_semanal" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por status</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie data={statusDist} dataKey="value" nameKey="name" outerRadius={90} label>
                            {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo da semana</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>• <strong>{totalTarefas}</strong> tarefas no período</p>
                      <p>• <strong>{concluidas}</strong> concluídas ({taxaConclusao}%)</p>
                      <p>• <strong className="text-destructive">{atrasadas}</strong> em atraso</p>
                      <p>• <strong className="text-amber-500">{semResponsavel}</strong> sem responsável atribuído</p>
                      <p>• <strong>{metasGlobal.length}</strong> metas formais ativas</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Burndown */}
              <TabsContent value="burndown" className="mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Burndown — tarefas restantes vs ideal</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={340}>
                      <AreaChart data={burndownData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="Ideal" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" fillOpacity={0.3} />
                        <Area type="monotone" dataKey="Restantes" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Atrasos */}
              <TabsContent value="atrasos" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Atrasadas por prioridade</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={atrasosPorPrioridade}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="prioridade" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="atrasadas" fill="hsl(var(--destructive))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 tarefas atrasadas</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-1.5 max-h-[260px] overflow-auto">
                        {tarefasGlobal
                          .filter((t) => t.data_prazo && new Date(t.data_prazo) < new Date() && t.status !== "concluida")
                          .slice(0, 10)
                          .map((t) => {
                            const diasAtraso = Math.abs(differenceInDays(parseISO(t.data_prazo), new Date()));
                            return (
                              <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded border bg-muted/20">
                                <span className="truncate flex-1">{t.titulo}</span>
                                <Badge variant="destructive" className="text-[10px]">
                                  {diasAtraso}d atrasada
                                </Badge>
                              </div>
                            );
                          })}
                        {atrasadas === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa atrasada</p>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Produtividade */}
              <TabsContent value="produtividade" className="mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Tarefas por responsável</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={produtividade}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="responsavel" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Total" fill="hsl(var(--muted-foreground))" />
                        <Bar dataKey="Concluídas" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Executivo C-Level */}
              <TabsContent value="executivo" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Score executivo</CardTitle></CardHeader>
                    <CardContent className="text-center py-8">
                      <div className="text-6xl font-bold text-primary">{scoreExecutivo}</div>
                      <p className="text-sm text-muted-foreground mt-2">/ 100 — saúde do portfólio</p>
                      <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">
                        Composto: 1/3 conclusão • 1/3 prazos • 1/3 metas
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Visão consolidada</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <Stat label="Projetos no escopo" value={projetoFiltro === "all" ? projetos?.length || 0 : 1} />
                        <Stat label="Tarefas totais" value={totalTarefas} />
                        <Stat label="Taxa de conclusão" value={`${taxaConclusao}%`} />
                        <Stat label="Metas formais" value={metasGlobal.length} />
                        <Stat label="Atraso (% do total)" value={`${totalTarefas ? Math.round((atrasadas / totalTarefas) * 100) : 0}%`} />
                        <Stat label="Sem responsável" value={`${totalTarefas ? Math.round((semResponsavel / totalTarefas) * 100) : 0}%`} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Preditivo IA */}
              <TabsContent value="preditivo" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Previsão de conclusão</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <Stat label="Ritmo médio" value={`${forecast.ritmoDia} tarefas/dia`} />
                      <Stat label="Restantes" value={totalTarefas - concluidas} />
                      <Stat label="Dias estimados" value={forecast.diasParaConcluir ?? "—"} />
                      <Stat label="Previsão" value={forecast.dataPrev} />
                      <p className="text-xs text-muted-foreground pt-2">
                        Modelo linear baseado no histórico do período. Para projeção avançada, gere o Resumo IA.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Resumo IA</CardTitle></CardHeader>
                    <CardContent>
                      {iaSummary ? (
                        <div className="text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">{iaSummary}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          Selecione um projeto e clique em "Resumo IA" para gerar análise narrativa.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
