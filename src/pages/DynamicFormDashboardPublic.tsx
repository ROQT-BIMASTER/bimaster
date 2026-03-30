import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartContainer } from "@/components/ui/chart-container";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  BarChart3, Users, CalendarDays, CheckCircle2,
  ClipboardList, Loader2, AlertTriangle,
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

interface AggResponse {
  id: string;
  created_at: string | null;
  answers: Record<string, any>;
}

export default function DynamicFormDashboardPublic() {
  const [searchParams] = useSearchParams();
  const formId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<AggResponse[]>([]);

  useEffect(() => {
    if (formId) loadData();
    else {
      setError("Formulário não especificado.");
      setLoading(false);
    }
  }, [formId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [formRes, fieldsRes, responsesRes] = await Promise.all([
        supabase.from("dynamic_forms").select("name").eq("id", formId!).eq("status", "active").single(),
        supabase.from("dynamic_form_fields").select("*").eq("form_id", formId!).order("order_index"),
        supabase.from("dynamic_form_responses").select("id, created_at").eq("form_id", formId!),
      ]);

      if (formRes.error || !formRes.data) {
        setError("Formulário não encontrado ou não está ativo.");
        setLoading(false);
        return;
      }

      setFormName(formRes.data.name);
      setFields(fieldsRes.data || []);

      const responseIds = (responsesRes.data || []).map((r: any) => r.id);
      let answersMap: Record<string, Record<string, any>> = {};

      if (responseIds.length > 0) {
        // Fetch in batches of 500 to avoid query limits
        for (let i = 0; i < responseIds.length; i += 500) {
          const batch = responseIds.slice(i, i + 500);
          const { data: answers } = await supabase
            .from("dynamic_form_answers")
            .select("response_id, field_id, value")
            .in("response_id", batch);

          (answers || []).forEach((a: any) => {
            if (!answersMap[a.response_id]) answersMap[a.response_id] = {};
            answersMap[a.response_id][a.field_id] = a.value;
          });
        }
      }

      setResponses(
        (responsesRes.data || []).map((r: any) => ({
          ...r,
          answers: answersMap[r.id] || {},
        }))
      );
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Erro</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            {loading ? "Carregando..." : formName}
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
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
                              <YAxis dataKey="name" type="category" width={120} className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
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
                                  {totalResponses > 0 ? `${((d.value / totalResponses) * 100).toFixed(1)}%` : "0%"}
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

            {/* Info about no charts */}
            {categoricalFields.length === 0 && totalResponses > 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Este formulário possui apenas campos de texto. Os KPIs acima resumem a participação.
                  </p>
                </CardContent>
              </Card>
            )}

            {totalResponses === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhuma resposta registrada ainda.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          Dados agregados — nenhuma informação individual é exibida
        </div>
      </div>
    </div>
  );
}
