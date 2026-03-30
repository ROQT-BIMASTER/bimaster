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

interface FieldInfo {
  id: string;
  label: string;
  field_type: string;
  order_index: number;
}

interface DistItem {
  label: string;
  count: number;
}

export default function DynamicFormDashboardPublic() {
  const [searchParams] = useSearchParams();
  const formId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [totalResponses, setTotalResponses] = useState(0);
  const [responsesToday, setResponsesToday] = useState(0);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [distributions, setDistributions] = useState<Record<string, DistItem[]>>({});

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
      // Get form name (public access to dynamic_forms is allowed)
      const { data: formData, error: formErr } = await supabase
        .from("dynamic_forms")
        .select("name")
        .eq("id", formId!)
        .eq("status", "active")
        .single();

      if (formErr || !formData) {
        setError("Formulário não encontrado ou não está ativo.");
        setLoading(false);
        return;
      }

      setFormName(formData.name);

      // Use RPC for aggregated stats only — no PII exposed
      const { data: stats, error: statsErr } = await supabase
        .rpc("get_form_public_stats", { p_form_id: formId! });

      if (statsErr || !stats) {
        setError("Erro ao carregar estatísticas.");
        setLoading(false);
        return;
      }

      const s = stats as any;
      if (s.error) {
        setError(s.error);
        setLoading(false);
        return;
      }

      setTotalResponses(s.total_responses || 0);
      setResponsesToday(s.responses_today || 0);
      setFields(s.fields || []);
      setDistributions(s.field_distributions || {});
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  const categoricalFields = fields.filter((f) =>
    ["select", "radio", "rating", "checkbox"].includes(f.field_type)
  );

  function getDistribution(fieldId: string) {
    const items = distributions[fieldId] || [];
    return items.map((d) => ({ name: d.label, value: d.count }));
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
                title="Campos Analisados"
                value={categoricalFields.length}
                icon={CheckCircle2}
                variant="info"
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
