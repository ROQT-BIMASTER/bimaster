/**
 * ReportWizard — create/edit a report definition with built-in layout linter feedback.
 * Uses the reports-orchestrator edge function for validate + save.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface LintFinding {
  severity: "ERROR" | "WARN" | "INFO";
  code: string;
  message: string;
  owner?: string;
}

export default function ReportWizard() {
  const { reportId } = useParams();
  const isNew = !reportId || reportId === "novo";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [findings, setFindings] = useState<LintFinding[]>([]);

  const [form, setForm] = useState({
    report_id: "",
    title: "",
    question: "",
    audience: "lideranca",
    frequency: "semanal",
    expected_action: "",
    layout_spec: JSON.stringify(
      {
        sections: [
          { type: "executive_summary", title: "Resumo executivo" },
          { type: "kpis", title: "KPIs principais", metrics: [] },
          { type: "chart", chart_type: "line", title: "Evolução" },
        ],
      },
      null,
      2,
    ),
    metric_refs: "[]",
  });

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("report_definitions")
        .select("*")
        .eq("report_id", reportId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Relatório não encontrado.");
        navigate("/dashboard/admin/relatorios-v2");
        return;
      }
      setForm({
        report_id: data.report_id,
        title: data.title,
        question: data.question,
        audience: data.audience,
        frequency: data.frequency,
        expected_action: data.expected_action,
        layout_spec: JSON.stringify(data.layout_spec ?? {}, null, 2),
        metric_refs: JSON.stringify(data.metric_refs ?? [], null, 2),
      });
      setLoading(false);
    })();
  }, [isNew, reportId, navigate]);

  const hasErrors = useMemo(() => findings.some((f) => f.severity === "ERROR"), [findings]);

  function parseJson<T>(s: string, fallback: T): T {
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  }

  async function save(publish: boolean) {
    setSaving(true);
    setFindings([]);
    try {
      const payload = {
        action: publish ? "publish_report_definition" : "upsert_report_definition",
        report: {
          report_id: form.report_id || crypto.randomUUID().slice(0, 8),
          title: form.title,
          question: form.question,
          audience: form.audience,
          frequency: form.frequency,
          expected_action: form.expected_action,
          layout_spec: parseJson(form.layout_spec, {}),
          metric_refs: parseJson(form.metric_refs, []),
        },
      };
      const { data, error } = await supabase.functions.invoke("reports-orchestrator", { body: payload });
      if (error) throw error;
      if (data?.findings) setFindings(data.findings as LintFinding[]);
      if (data?.error) {
        toast.error(String(data.error));
        return;
      }
      if (publish && (data?.findings ?? []).some((f: LintFinding) => f.severity === "ERROR")) {
        toast.error("Publicação bloqueada pelo linter. Corrija os erros.");
        return;
      }
      toast.success(publish ? "Relatório publicado." : "Rascunho salvo.");
      navigate(`/dashboard/admin/relatorios-v2/${payload.report.report_id}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <h1 className="text-xl font-semibold text-foreground">
            {isNew ? "Novo relatório" : `Editar · ${form.title}`}
          </h1>
        </div>
      </header>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">1. Objetivo</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Identificador técnico</Label>
            <Input
              value={form.report_id}
              onChange={(e) => setForm({ ...form, report_id: e.target.value })}
              placeholder="ex.: vendas-semanal-comercial"
              disabled={!isNew}
            />
          </div>
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Pergunta que responde</Label>
          <Textarea
            rows={2}
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder="O que este relatório ajuda a decidir?"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Audiência</Label>
            <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lideranca">Liderança</SelectItem>
                <SelectItem value="operacao">Operação</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Frequência</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="ad-hoc">Ad-hoc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ação esperada</Label>
            <Input
              value={form.expected_action}
              onChange={(e) => setForm({ ...form, expected_action: e.target.value })}
              placeholder="aprovar, priorizar, corrigir…"
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">2. Métricas referenciadas (JSON)</h2>
        <Textarea
          rows={5}
          className="font-mono text-xs"
          value={form.metric_refs}
          onChange={(e) => setForm({ ...form, metric_refs: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Lista de IDs de métricas do glossário (semantic layer).
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">3. Layout (JSON)</h2>
        <Textarea
          rows={12}
          className="font-mono text-xs"
          value={form.layout_spec}
          onChange={(e) => setForm({ ...form, layout_spec: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          O layout passa pelo linter antes da publicação. Erros bloqueiam o "Publicar".
        </p>
      </Card>

      {findings.length > 0 && (
        <Card className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">Validação do layout</h3>
          {findings.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {f.severity === "ERROR" ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
              ) : f.severity === "WARN" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
              )}
              <div>
                <span className="font-medium">[{f.code}]</span> {f.message}
                {f.owner && <Badge variant="outline" className="ml-2">{f.owner}</Badge>}
              </div>
            </div>
          ))}
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={() => save(false)}>
          <Save className="mr-2 h-4 w-4" /> Salvar rascunho
        </Button>
        <Button disabled={saving || hasErrors} onClick={() => save(true)}>
          Publicar
        </Button>
      </div>
    </div>
  );
}
