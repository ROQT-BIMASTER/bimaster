/**
 * Reports v2 Home — Notion-level reports console (Phase 1+).
 * Lists report_definitions accessible to the user and their recent runs.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportDef {
  report_id: string;
  title: string;
  question: string;
  audience: string;
  frequency: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
}

interface ReportRun {
  id: string;
  report_id: string;
  status: string;
  created_at: string;
  finished_at: string | null;
}

export default function ReportsV2Home() {
  const [defs, setDefs] = useState<ReportDef[]>([]);
  const [runs, setRuns] = useState<Record<string, ReportRun | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("report_definitions")
      .select("report_id,title,question,audience,frequency,status,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar relatórios.");
    } else {
      const list = (data ?? []) as ReportDef[];
      setDefs(list);
      if (list.length) {
        const ids = list.map((d) => d.report_id);
        const { data: rr } = await (supabase as any)
          .from("report_runs")
          .select("id,report_id,status,created_at,finished_at")
          .in("report_id", ids)
          .order("created_at", { ascending: false });
        const byId: Record<string, ReportRun> = {};
        (rr ?? []).forEach((r: ReportRun) => {
          if (!byId[r.report_id]) byId[r.report_id] = r;
        });
        setRuns(byId);
      }
    }
    setLoading(false);
  }

  async function runReport(reportId: string) {
    setRunning(reportId);
    try {
      const { data, error } = await supabase.functions.invoke("reports-orchestrator", {
        body: { action: "run_report", reportId, mode: "preview" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success("Execução iniciada.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao executar.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Console moderno: definições versionadas, execuções auditáveis e contrato de números.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/admin/relatorios-v2/novo">
            <Plus className="mr-2 h-4 w-4" /> Novo relatório
          </Link>
        </Button>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : defs.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum relatório ainda. Crie o primeiro com o assistente.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {defs.map((d) => {
            const last = runs[d.report_id];
            return (
              <Card key={d.report_id} className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/dashboard/admin/relatorios-v2/${d.report_id}`}
                      className="truncate text-sm font-semibold text-foreground hover:underline"
                    >
                      {d.title}
                    </Link>
                    <Badge variant={d.status === "published" ? "default" : "outline"}>
                      {d.status}
                    </Badge>
                    <Badge variant="outline">{d.frequency}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{d.question}</p>
                  {last && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Última execução {formatDistanceToNow(new Date(last.created_at), { addSuffix: true, locale: ptBR })} · {last.status}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={running === d.report_id}
                  onClick={() => runReport(d.report_id)}
                >
                  <Play className="mr-2 h-3.5 w-3.5" />
                  {running === d.report_id ? "Executando…" : "Executar"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
