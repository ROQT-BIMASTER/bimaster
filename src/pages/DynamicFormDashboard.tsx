import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartContainer } from "@/components/ui/chart-container";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ClipboardList, BarChart3, Users, CalendarDays, CheckCircle2,
  Sparkles, Loader2, ArrowLeft, ChevronDown, ChevronUp,
} from "lucide-react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
];

interface FormField {
  id: string;
  label: string;
  field_type: string;
  options: any;
  required: boolean | null;
  order_index: number;
}

interface FormResponse {
  id: string;
  created_at: string | null;
  user_id: string | null;
  client_id: string | null;
  metadata: any;
  answers: Record<string, any>;
}

export default function DynamicFormDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const formId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [formName, setFormName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  useEffect(() => {
    if (formId) loadData();
  }, [formId]);

  async function loadData() {
    setLoading(true);
    try {
      const [formRes, fieldsRes, responsesRes] = await Promise.all([
        supabase.from("dynamic_forms").select("name").eq("id", formId!).single(),
        supabase.from("dynamic_form_fields").select("*").eq("form_id", formId!).order("order_index"),
        supabase.from("dynamic_form_responses").select("*").eq("form_id", formId!).order("created_at", { ascending: false }),
      ]);

      if (formRes.error) throw formRes.error;
      setFormName(formRes.data.name);
      setFields(fieldsRes.data || []);

      const responseIds = (responsesRes.data || []).map((r: any) => r.id);
      let answersMap: Record<string, Record<string, any>> = {};

      if (responseIds.length > 0) {
        const { data: answers } = await supabase
          .from("dynamic_form_answers")
          .select("response_id, field_id, value")
          .in("response_id", responseIds);

        (answers || []).forEach((a: any) => {
          if (!answersMap[a.response_id]) answersMap[a.response_id] = {};
          answersMap[a.response_id][a.field_id] = a.value;
        });
      }

      setResponses(
        (responsesRes.data || []).map((r: any) => ({
          ...r,
          answers: answersMap[r.id] || {},
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados do formulário");
    } finally {
      setLoading(false);
    }
  }

  // KPIs
  const totalResponses = responses.length;
  const today = new Date().toISOString().slice(0, 10);
  const responsesToday = responses.filter(
    (r) => r.created_at?.slice(0, 10) === today
  ).length;

  const requiredFields = fields.filter((f) => f.required);
  const completionRate = useMemo(() => {
    if (responses.length === 0 || requiredFields.length === 0) return 100;
    let filled = 0;
    let total = 0;
    responses.forEach((r) => {
      requiredFields.forEach((f) => {
        total++;
        const val = r.answers[f.id];
        if (val !== null && val !== undefined && val !== "") filled++;
      });
    });
    return total > 0 ? Math.round((filled / total) * 100) : 100;
  }, [responses, requiredFields]);

  // Chart data for categorical fields
  const categoricalFields = fields.filter((f) =>
    ["select", "radio", "rating", "checkbox"].includes(f.field_type)
  );

  function getDistribution(fieldId: string) {
    const counts: Record<string, number> = {};
    responses.forEach((r) => {
      const val = r.answers[fieldId];
      if (val === null || val === undefined) return;
      const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
      counts[strVal] = (counts[strVal] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  // AI Analysis
  async function handleAiAnalysis() {
    setAiLoading(true);
    setAiDialogOpen(true);
    setAiReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-form-responses", {
        body: { formId },
      });
      if (error) throw error;
      setAiReport(data?.report || "Sem dados para análise.");
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("429") || err?.status === 429) {
        toast.error("Limite de requisições excedido. Tente novamente em alguns instantes.");
      } else if (err?.message?.includes("402") || err?.status === 402) {
        toast.error("Créditos insuficientes. Adicione créditos em Configurações.");
      } else {
        toast.error("Erro ao gerar análise IA");
      }
      setAiReport("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  }

  function formatValue(val: any): string {
    if (val === null || val === undefined) return "—";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }

  if (!formId) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          Nenhum formulário selecionado.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div>
          <ModuleBreadcrumb
            moduleName="Trade Marketing"
            moduleHref="/dashboard/trade"
            currentPage="Dashboard do Formulário"
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                {loading ? "Carregando..." : formName}
              </h1>
            </div>
            <Button
              onClick={handleAiAnalysis}
              disabled={aiLoading || responses.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Análise IA
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                title="Total de Respostas"
                value={totalResponses}
                icon={Users}
                variant="info"
              />
              <KpiCard
                title="Respostas Hoje"
                value={responsesToday}
                icon={CalendarDays}
                variant="success"
              />
              <KpiCard
                title="Preenchimento Obrigatórios"
                value={`${completionRate}%`}
                icon={CheckCircle2}
                variant={completionRate >= 80 ? "success" : "warning"}
              />
            </div>

            {/* Charts */}
            {categoricalFields.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {categoricalFields.map((field) => {
                  const data = getDistribution(field.id);
                  if (data.length === 0) return null;

                  const useBar = data.length > 5;

                  return (
                    <ChartContainer
                      key={field.id}
                      title={field.label}
                      icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
                      chartHeight="h-[300px]"
                      chart={
                        useBar ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis type="number" className="text-xs fill-muted-foreground" />
                              <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                className="text-xs fill-muted-foreground"
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) =>
                                  `${name} (${(percent * 100).toFixed(0)}%)`
                                }
                              >
                                {data.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        )
                      }
                      table={
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Valor</TableHead>
                              <TableHead className="text-right">Contagem</TableHead>
                              <TableHead className="text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.map((d) => (
                              <TableRow key={d.name}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell className="text-right">{d.value}</TableCell>
                                <TableCell className="text-right">
                                  {totalResponses > 0
                                    ? `${((d.value / totalResponses) * 100).toFixed(1)}%`
                                    : "0%"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Response Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Respostas ({totalResponses})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma resposta registrada ainda.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Data</TableHead>
                        {fields.slice(0, 3).map((f) => (
                          <TableHead key={f.id}>{f.label}</TableHead>
                        ))}
                        {fields.length > 3 && (
                          <TableHead>+{fields.length - 3} campos</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((resp) => (
                        <>
                          <TableRow
                            key={resp.id}
                            className="cursor-pointer"
                            onClick={() =>
                              setExpandedRow(expandedRow === resp.id ? null : resp.id)
                            }
                          >
                            <TableCell>
                              {expandedRow === resp.id ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {resp.created_at
                                ? new Date(resp.created_at).toLocaleString("pt-BR")
                                : "—"}
                            </TableCell>
                            {fields.slice(0, 3).map((f) => (
                              <TableCell key={f.id} className="text-sm max-w-[200px] truncate">
                                {formatValue(resp.answers[f.id])}
                              </TableCell>
                            ))}
                            {fields.length > 3 && <TableCell />}
                          </TableRow>
                          {expandedRow === resp.id && (
                            <TableRow key={`${resp.id}-expanded`}>
                              <TableCell colSpan={fields.slice(0, 3).length + 2 + (fields.length > 3 ? 1 : 0)}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 px-4 bg-muted/30 rounded-md">
                                  {fields.map((f) => (
                                    <div key={f.id}>
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {f.label}
                                      </span>
                                      <p className="text-sm mt-0.5">
                                        {formatValue(resp.answers[f.id])}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* AI Report Dialog */}
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Análise IA — {formName}
              </DialogTitle>
            </DialogHeader>
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando respostas...</p>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{aiReport || ""}</ReactMarkdown>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
