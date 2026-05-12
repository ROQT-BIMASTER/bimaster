import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Copy, Download, Loader2, Search, AlertTriangle, CheckCircle2,
  Clock, Ship, FileText, ListChecks, TrendingUp, Calendar, Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { invokeChat } from "@/lib/ai/invokeChat";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { chartColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";

type Idioma = "pt" | "en" | "zh";
type Profundidade = "executivo" | "completo";

type Resultado = {
  markdown: string;
  kpis: {
    etapas_concluidas: number;
    etapas_totais: number;
    atrasos_count: number;
    dias_para_embarque: number | null;
    risco: "alto" | "medio" | "baixo";
  };
  analytics?: {
    progresso_pct: number;
    por_coluna: Array<{ coluna: string; concluido: number; pendente: number; atrasado: number }>;
    docs_resumo: { total: number; oficializado: number; pendente: number };
    ocs_resumo: { total: number; aprovadas: number; em_producao: number; concluidas: number };
    embarques_resumo: { total: number; em_transito: number; entregues: number };
    atrasos_top: Array<{ coluna: string; item: string; prazo: string | null; responsavel: string | null; dias_atraso: number | null }>;
    marcos: Array<{ data: string | null; label: string; status: "ok" | "pending" | "late"; tipo: string }>;
  };
  submissao: { id: string; codigo: string; nome: string };
  model: string;
};

const I18N: Record<Idioma, Record<string, string>> = {
  pt: {
    title: "Copiloto de Submissão",
    subtitle: "Relatório executivo gerado por IA com indicadores e linha do tempo",
    searchLabel: "Número da submissão / OC / produto",
    searchPlaceholder: "Ex.: 3777 ou nome do produto",
    language: "Idioma do relatório",
    depth: "Profundidade",
    executive: "Resumo executivo",
    full: "Relatório completo",
    generate: "Gerar relatório",
    regenerate: "Regenerar",
    generating: "Gerando relatório…",
    copy: "Copiar", download: "Baixar .md", print: "Imprimir / PDF",
    progress: "Progresso geral", completed: "Etapas concluídas",
    delays: "Atrasos", daysShip: "Dias até embarque", risk: "Risco",
    docs: "Documentos", ocs: "Ordens de compra", embarques: "Embarques",
    overview: "Visão executiva", chartsTab: "Indicadores", timelineTab: "Linha do tempo", reportTab: "Relatório completo",
    delaysTitle: "Atrasos prioritários para tomada de decisão",
    noDelays: "Nenhum atraso identificado.",
    decisions: "Pontos para decisão imediata",
    riskLow: "baixo", riskMed: "médio", riskHigh: "alto",
    empty: "Selecione uma submissão e clique em Gerar relatório.",
    statusOk: "Concluído", statusPending: "Pendente", statusLate: "Atrasado",
    deadline: "Prazo", owner: "Responsável", item: "Item", area: "Área", daysLate: "Dias",
  },
  en: {
    title: "Submission Copilot",
    subtitle: "AI executive report with KPIs, charts and timeline",
    searchLabel: "Submission / PO number / product",
    searchPlaceholder: "e.g. 3777 or product name",
    language: "Report language", depth: "Depth",
    executive: "Executive summary", full: "Full report",
    generate: "Generate report", regenerate: "Regenerate", generating: "Generating…",
    copy: "Copy", download: "Download .md", print: "Print / PDF",
    progress: "Overall progress", completed: "Completed steps",
    delays: "Delays", daysShip: "Days to shipment", risk: "Risk",
    docs: "Documents", ocs: "Purchase orders", embarques: "Shipments",
    overview: "Executive view", chartsTab: "KPIs", timelineTab: "Timeline", reportTab: "Full report",
    delaysTitle: "Top delays for decision-making", noDelays: "No delays detected.",
    decisions: "Immediate decision points",
    riskLow: "low", riskMed: "medium", riskHigh: "high",
    empty: "Select a submission and click Generate report.",
    statusOk: "Done", statusPending: "Pending", statusLate: "Overdue",
    deadline: "Deadline", owner: "Owner", item: "Item", area: "Area", daysLate: "Days",
  },
  zh: {
    title: "提交副驾驶", subtitle: "AI 执行报告:KPI、图表和时间线",
    searchLabel: "提交号 / 采购订单号 / 产品", searchPlaceholder: "例如:3777 或产品名称",
    language: "报告语言", depth: "详细程度", executive: "执行摘要", full: "完整报告",
    generate: "生成报告", regenerate: "重新生成", generating: "正在生成…",
    copy: "复制", download: "下载 .md", print: "打印 / PDF",
    progress: "整体进度", completed: "已完成步骤", delays: "延误",
    daysShip: "距离装运天数", risk: "风险",
    docs: "文档", ocs: "采购订单", embarques: "装运",
    overview: "执行视图", chartsTab: "指标", timelineTab: "时间线", reportTab: "完整报告",
    delaysTitle: "优先处理的延误", noDelays: "未检测到延误。",
    decisions: "立即决策要点",
    riskLow: "低", riskMed: "中", riskHigh: "高",
    empty: "选择一个提交并点击生成报告。",
    statusOk: "完成", statusPending: "待处理", statusLate: "逾期",
    deadline: "截止日期", owner: "负责人", item: "项目", area: "区域", daysLate: "天数",
  },
};

interface Sugestao { id: string; produto_codigo: string; produto_nome: string; numero_ordem: string | null }

interface Props { open: boolean; onOpenChange: (open: boolean) => void; initialQuery?: string }

export function SubmissionCopilotPanel({ open, onOpenChange, initialQuery = "" }: Props) {
  const [idioma, setIdioma] = useState<Idioma>("pt");
  const [profundidade, setProfundidade] = useState<Profundidade>("completo");
  const [query, setQuery] = useState(initialQuery);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [selecionada, setSelecionada] = useState<Sugestao | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const t = I18N[idioma];

  useEffect(() => { if (open) setQuery(initialQuery); }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setSugestoes([]); return; }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("china_produto_submissoes")
        .select("id, produto_codigo, produto_nome, numero_ordem")
        .or(`produto_codigo.ilike.%${q}%,produto_nome.ilike.%${q}%,numero_ordem.ilike.%${q}%,numero_item.ilike.%${q}%`)
        .is("deleted_at", null)
        .limit(8);
      setSugestoes((data ?? []) as Sugestao[]);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleGerar = async () => {
    if (!selecionada) {
      toast.error(idioma === "pt" ? "Selecione uma submissão" : idioma === "en" ? "Select a submission" : "请选择提交");
      return;
    }
    setLoading(true);
    setResultado(null);
    const { data, error } = await invokeChat<Resultado>(
      "china-submission-copilot",
      { submissao_id: selecionada.id, idioma, profundidade },
      { timeoutMs: 150_000 },
    );
    setLoading(false);
    if (error || !data) {
      toast.error(error?.userMessage ?? "Erro ao gerar relatório");
      return;
    }
    setResultado(data);
  };

  const riscoMeta = useMemo(() => {
    if (!resultado) return null;
    const r = resultado.kpis.risco;
    const label = r === "alto" ? t.riskHigh : r === "medio" ? t.riskMed : t.riskLow;
    const tone = r === "alto" ? "bg-destructive/10 text-destructive border-destructive/30"
      : r === "medio" ? "bg-warning/10 text-warning border-warning/30"
      : "bg-success/10 text-success border-success/30";
    return { label, tone };
  }, [resultado, t]);

  const handleCopy = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(resultado.markdown);
    toast.success(idioma === "pt" ? "Copiado" : idioma === "en" ? "Copied" : "已复制");
  };

  const handleDownload = () => {
    if (!resultado) return;
    const blob = new Blob([resultado.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${resultado.submissao.codigo}-${idioma}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!resultado) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const html = document.getElementById("copilot-report-content")?.innerHTML ?? "";
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${resultado.submissao.codigo}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;max-width:780px;margin:32px auto;padding:0 16px;color:#111;line-height:1.55}
      h1,h2,h3{margin-top:1.6em}table{border-collapse:collapse;width:100%;margin:12px 0}
      th,td{border:1px solid #ddd;padding:6px 10px;font-size:13px;text-align:left}th{background:#f7f7f7}</style>
      </head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const a = resultado?.analytics;

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try {
      const dt = d.length === 10 ? parseLocalDate(d) : new Date(d);
      return dt.toLocaleDateString(idioma === "zh" ? "zh-CN" : idioma === "en" ? "en-US" : "pt-BR");
    } catch { return "—"; }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[920px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.title}
          </SheetTitle>
          <SheetDescription>{t.subtitle}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Controles */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-xs">{t.searchLabel}</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelecionada(null); }}
                  placeholder={t.searchPlaceholder}
                  className="pl-7 h-9"
                />
              </div>
              {sugestoes.length > 0 && !selecionada && (
                <div className="rounded-md border border-border bg-popover max-h-56 overflow-y-auto">
                  {sugestoes.map((s) => (
                    <button key={s.id} onClick={() => { setSelecionada(s); setQuery(`${s.produto_codigo} — ${s.produto_nome}`); setSugestoes([]); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent border-b border-border last:border-b-0">
                      <div className="font-medium">{s.produto_codigo}</div>
                      <div className="text-muted-foreground truncate">{s.produto_nome}</div>
                      {s.numero_ordem && <div className="text-[10px] text-muted-foreground">OC: {s.numero_ordem}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs">{t.language}</Label>
              <div className="flex gap-1">
                {(["pt", "en", "zh"] as Idioma[]).map((l) => (
                  <button key={l} onClick={() => setIdioma(l)}
                    className={cn("flex-1 px-2 py-1.5 rounded-md text-xs border transition-colors",
                      idioma === l ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent")}>
                    {l === "pt" ? "PT" : l === "en" ? "EN" : "中"}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs">{t.depth}</Label>
              <div className="flex gap-1">
                {(["executivo", "completo"] as Profundidade[]).map((p) => (
                  <button key={p} onClick={() => setProfundidade(p)}
                    className={cn("flex-1 px-2 py-1.5 rounded-md text-xs border transition-colors",
                      profundidade === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent")}>
                    {p === "executivo" ? t.executive : t.full}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleGerar} disabled={loading || !selecionada} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? t.generating : resultado ? t.regenerate : t.generate}
          </Button>

          {resultado && (
            <div className="space-y-4 pt-2 border-t border-border">
              {/* Header executivo */}
              <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.overview}</div>
                    <div className="font-semibold truncate">{resultado.submissao.codigo} — {resultado.submissao.nome}</div>
                  </div>
                  {riscoMeta && (
                    <Badge variant="outline" className={cn("border", riscoMeta.tone)}>
                      <AlertTriangle className="h-3 w-3 mr-1" />{t.risk}: {riscoMeta.label}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t.progress}</span>
                    <span className="font-medium tabular-nums">{a?.progresso_pct ?? 0}%</span>
                  </div>
                  <Progress value={a?.progresso_pct ?? 0} className="h-2" />
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <KpiTile icon={CheckCircle2} label={t.completed} value={`${resultado.kpis.etapas_concluidas}/${resultado.kpis.etapas_totais}`} tone="ok" />
                <KpiTile icon={AlertTriangle} label={t.delays} value={resultado.kpis.atrasos_count} tone={resultado.kpis.atrasos_count > 0 ? "warn" : "ok"} />
                <KpiTile icon={Ship} label={t.daysShip} value={resultado.kpis.dias_para_embarque ?? "—"} />
                <KpiTile icon={FileText} label={t.docs} value={`${a?.docs_resumo.oficializado ?? 0}/${a?.docs_resumo.total ?? 0}`} />
                <KpiTile icon={ListChecks} label={t.ocs} value={`${a?.ocs_resumo.aprovadas ?? 0}/${a?.ocs_resumo.total ?? 0}`} />
                <KpiTile icon={TrendingUp} label={t.embarques} value={`${a?.embarques_resumo.entregues ?? 0}/${a?.embarques_resumo.total ?? 0}`} />
              </div>

              {/* Ações */}
              <div className="flex gap-1.5 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3.5 w-3.5 mr-1.5" />{t.copy}</Button>
                <Button variant="outline" size="sm" onClick={handleDownload}><Download className="h-3.5 w-3.5 mr-1.5" />{t.download}</Button>
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1.5" />{t.print}</Button>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="charts">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="charts">{t.chartsTab}</TabsTrigger>
                  <TabsTrigger value="timeline">{t.timelineTab}</TabsTrigger>
                  <TabsTrigger value="report">{t.reportTab}</TabsTrigger>
                </TabsList>

                <TabsContent value="charts" className="mt-3 space-y-3">
                  {/* Decisão imediata */}
                  <div className="rounded-md border border-border bg-card/50 p-3">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" /> {t.delaysTitle}
                    </div>
                    {a && a.atrasos_top.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="py-1.5 pr-2">{t.area}</th>
                              <th className="py-1.5 pr-2">{t.item}</th>
                              <th className="py-1.5 pr-2">{t.deadline}</th>
                              <th className="py-1.5 pr-2">{t.owner}</th>
                              <th className="py-1.5 text-right">{t.daysLate}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.atrasos_top.map((d, i) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-1.5 pr-2">{d.coluna}</td>
                                <td className="py-1.5 pr-2 font-medium">{d.item}</td>
                                <td className="py-1.5 pr-2">{fmtDate(d.prazo)}</td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{d.responsavel ?? "—"}</td>
                                <td className="py-1.5 text-right tabular-nums text-destructive font-semibold">
                                  {d.dias_atraso != null ? `+${d.dias_atraso}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t.noDelays}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Pie progresso */}
                    <div className="rounded-md border border-border bg-card/50 p-3">
                      <div className="text-xs font-semibold mb-2">{t.progress}</div>
                      <div className="h-[200px]">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={[
                                { name: t.statusOk, value: resultado.kpis.etapas_concluidas },
                                { name: t.statusPending, value: Math.max(0, resultado.kpis.etapas_totais - resultado.kpis.etapas_concluidas - resultado.kpis.atrasos_count) },
                                { name: t.statusLate, value: resultado.kpis.atrasos_count },
                              ]}
                              dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}
                            >
                              <Cell fill={chartColors.success} />
                              <Cell fill={chartColors.warning} />
                              <Cell fill={chartColors.destructive} />
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: 11 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bar por coluna */}
                    <div className="rounded-md border border-border bg-card/50 p-3">
                      <div className="text-xs font-semibold mb-2">Status por área</div>
                      <div className="h-[200px]">
                        <ResponsiveContainer>
                          <BarChart data={a?.por_coluna ?? []} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="coluna" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ fontSize: 11 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="concluido" stackId="s" fill={chartColors.success} name={t.statusOk} />
                            <Bar dataKey="pendente" stackId="s" fill={chartColors.warning} name={t.statusPending} />
                            <Bar dataKey="atrasado" stackId="s" fill={chartColors.destructive} name={t.statusLate} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-3">
                  <div className="rounded-md border border-border bg-card/50 p-3">
                    {a && a.marcos.length > 0 ? (
                      <ol className="relative border-l border-border ml-2 space-y-3">
                        {a.marcos.map((m, i) => {
                          const dotTone = m.status === "ok" ? "bg-success" : m.status === "late" ? "bg-destructive" : "bg-warning";
                          const Icon = m.tipo === "embarque" ? Ship : m.tipo === "oc" ? ListChecks : m.status === "late" ? AlertTriangle : Calendar;
                          return (
                            <li key={i} className="ml-4">
                              <span className={cn("absolute -left-1.5 mt-1 h-3 w-3 rounded-full ring-2 ring-background", dotTone)} />
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs">
                                  <div className="flex items-center gap-1.5 font-medium">
                                    <Icon className="h-3 w-3" />
                                    {m.label}
                                  </div>
                                  <div className="text-muted-foreground text-[10px]">{fmtDate(m.data)}</div>
                                </div>
                                {m.status === "late" && (
                                  <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 text-[10px]">
                                    {t.statusLate}
                                  </Badge>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">—</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="report" className="mt-3">
                  <div id="copilot-report-content"
                    className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-table:text-xs">
                    <ReactMarkdown>{resultado.markdown}</ReactMarkdown>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {!resultado && !loading && (
            <p className="text-xs text-muted-foreground text-center py-8">{t.empty}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KpiTile({
  icon: Icon, label, value, tone = "default",
}: { icon: any; label: string; value: string | number; tone?: "ok" | "warn" | "default" }) {
  const toneCls =
    tone === "warn" ? "border-destructive/30 bg-destructive/5"
    : tone === "ok" ? "border-success/30 bg-success/5"
    : "border-border bg-card/50";
  const iconCls =
    tone === "warn" ? "text-destructive"
    : tone === "ok" ? "text-success"
    : "text-primary";
  return (
    <div className={cn("rounded-md border p-2.5 flex items-center gap-2.5", toneCls)}>
      <div className={cn("h-8 w-8 rounded-md bg-background/60 flex items-center justify-center", iconCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
        <div className="text-base font-semibold tabular-nums leading-tight">{value}</div>
      </div>
    </div>
  );
}
