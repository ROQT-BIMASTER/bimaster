import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Activity, KeyRound, Search, Play, RefreshCw, AlertTriangle, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { SecurityTrendsCharts } from "@/components/admin/security/SecurityTrendsCharts";
import { SecurityVersionCompare } from "@/components/admin/security/SecurityVersionCompare";

type Metrics = {
  mfa_enrolled: number;
  mfa_required_users: number;
  waf_shadow_24h: number;
  anomalies_24h: number;
  quarantined_active: number;
  last_pentest_score: number | null;
  last_pentest_at: string | null;
  open_dep_findings: number;
  secrets_due_rotation: number;
};

async function callMetrics(op: string, params?: Record<string, string>) {
  const url = new URL("https://aokkyrgaqjarhlywhjju.functions.supabase.co/security-metrics-v2");
  url.searchParams.set("op", op);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const sevColor = (s: string) => ({
  critical: "destructive", high: "destructive", medium: "secondary",
  low: "outline", info: "outline", moderate: "secondary",
}[s] ?? "outline") as any;

export default function SecurityHardeningCenterV2() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("pentest");

  // pentest
  const [runs, setRuns] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // anomalies
  const [anomalies, setAnomalies] = useState<any[]>([]);

  // secrets
  const [secrets, setSecrets] = useState<any[]>([]);

  // dependencies
  const [deps, setDeps] = useState<any[]>([]);

  // forense
  const [forUser, setForUser] = useState("");
  const [forHours, setForHours] = useState("24");
  const [forResult, setForResult] = useState<any>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const m = await callMetrics("metrics");
      setMetrics(m);
      const [r, a, s, d] = await Promise.all([
        callMetrics("pentest_runs"),
        callMetrics("anomalies"),
        callMetrics("secrets"),
        callMetrics("dependencies"),
      ]);
      setRuns(r); setAnomalies(a); setSecrets(s); setDeps(d);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  const runPentest = async (mode: "dry_run" | "full") => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("https://aokkyrgaqjarhlywhjju.functions.supabase.co/pentest-runner", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`Pentest concluído: ${data.passed}/${data.total} (score ${Math.round(data.score)}%)`);
      await reload();
      setSelectedRun(data.run_id);
      setFindings(data.findings.map((f: any) => ({ ...f, run_id: data.run_id })));
    } catch (e: any) {
      toast.error("Pentest falhou: " + e.message);
    } finally { setRunning(false); }
  };

  const loadFindings = async (runId: string) => {
    setSelectedRun(runId);
    const f = await callMetrics("pentest_findings", { run_id: runId });
    setFindings(f);
  };

  const runForensic = async () => {
    if (!forUser) return toast.error("Informe user_id");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(
        `https://aokkyrgaqjarhlywhjju.functions.supabase.co/forensic-snapshot?user_id=${forUser}&hours=${forHours}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!r.ok) throw new Error(await r.text());
      setForResult(await r.json());
      toast.success("Snapshot gerado");
    } catch (e: any) {
      toast.error("Forense falhou: " + e.message + " (pode exigir step-up)");
    }
  };

  const downloadSnapshot = () => {
    if (!forResult) return;
    const blob = new Blob([JSON.stringify(forResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forensic-${forUser}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mfaPct = metrics ? Math.round((metrics.mfa_enrolled / Math.max(1, metrics.mfa_required_users)) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Hardening Center v2
          </h1>
          <p className="text-sm text-muted-foreground">Pentest + camadas profundas de segurança (v3.4.70)</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cobertura MFA</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mfaPct}%</div>
            <p className="text-xs text-muted-foreground">{metrics?.mfa_enrolled ?? 0}/{metrics?.mfa_required_users ?? 0} admins/gerentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pentest Score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.last_pentest_score ?? "-"}{metrics?.last_pentest_score != null ? "%" : ""}</div>
            <p className="text-xs text-muted-foreground">{metrics?.last_pentest_at ? new Date(metrics.last_pentest_at).toLocaleString() : "Nunca executado"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Anomalias 24h</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.anomalies_24h ?? 0}</div>
            <p className="text-xs text-muted-foreground">{metrics?.quarantined_active ?? 0} contas em quarentena</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">WAF Shadow 24h</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.waf_shadow_24h ?? 0}</div>
            <p className="text-xs text-muted-foreground">{metrics?.open_dep_findings ?? 0} CVEs abertos · {metrics?.secrets_due_rotation ?? 0} segredos vencidos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-2" />Tendências</TabsTrigger>
          <TabsTrigger value="pentest"><Play className="h-4 w-4 mr-2" />Pentest</TabsTrigger>
          <TabsTrigger value="anomalies"><Activity className="h-4 w-4 mr-2" />Anomalias</TabsTrigger>
          <TabsTrigger value="secrets"><KeyRound className="h-4 w-4 mr-2" />Segredos</TabsTrigger>
          <TabsTrigger value="deps"><AlertTriangle className="h-4 w-4 mr-2" />Dependências</TabsTrigger>
          <TabsTrigger value="forensic"><Search className="h-4 w-4 mr-2" />Forense</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <SecurityTrendsCharts />
          <SecurityVersionCompare />
        </TabsContent>

        <TabsContent value="pentest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Executar pentest</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => runPentest("dry_run")} disabled={running}>
                {running ? "Executando..." : "Dry Run"}
              </Button>
              <Button variant="destructive" onClick={() => runPentest("full")} disabled={running}>
                Full (requer step-up)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de execuções</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Quando</TableHead><TableHead>Modo</TableHead><TableHead>Status</TableHead>
                  <TableHead>Score</TableHead><TableHead>Pass/Fail</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {runs.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{r.mode}</Badge></TableCell>
                      <TableCell><Badge>{r.status}</Badge></TableCell>
                      <TableCell className="font-mono">{r.score ?? "-"}</TableCell>
                      <TableCell className="text-xs">{r.passed}/{r.failed}/{r.skipped}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => loadFindings(r.id)}>Ver</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedRun && (
            <Card>
              <CardHeader><CardTitle>Findings — {selectedRun.slice(0, 8)}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Check</TableHead><TableHead>Categoria</TableHead><TableHead>CWE</TableHead>
                    <TableHead>Sev</TableHead><TableHead>Resultado</TableHead><TableHead>Título</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {findings.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{f.check_id}</TableCell>
                        <TableCell className="text-xs">{f.category}</TableCell>
                        <TableCell className="text-xs">{f.cwe_id ?? "-"}</TableCell>
                        <TableCell><Badge variant={sevColor(f.severity)}>{f.severity}</Badge></TableCell>
                        <TableCell>
                          {f.result === "pass" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {f.result === "fail" && <XCircle className="h-4 w-4 text-destructive" />}
                          {(f.result === "skip" || f.result === "error") && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                        </TableCell>
                        <TableCell className="text-sm">{f.title}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="anomalies">
          <Card>
            <CardHeader><CardTitle>Anomalias recentes (100)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Quando</TableHead><TableHead>Usuário</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Sev</TableHead><TableHead>IP</TableHead><TableHead>País</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {anomalies.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma anomalia detectada</TableCell></TableRow>}
                  {anomalies.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{a.user_id?.slice(0, 8) ?? "-"}</TableCell>
                      <TableCell>{a.anomaly_type}</TableCell>
                      <TableCell><Badge variant={sevColor(a.severity)}>{a.severity}</Badge></TableCell>
                      <TableCell className="text-xs">{a.ip ?? "-"}</TableCell>
                      <TableCell className="text-xs">{a.country ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secrets">
          <Card>
            <CardHeader><CardTitle>Política de rotação de segredos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Segredo</TableHead><TableHead>Categoria</TableHead><TableHead>Crítico</TableHead>
                  <TableHead>Intervalo</TableHead><TableHead>Última rotação</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {secrets.map(s => {
                    const last = s.last_rotated_at ? new Date(s.last_rotated_at) : null;
                    const due = !last || (Date.now() - last.getTime()) > s.rotation_interval_days * 86400_000;
                    return (
                      <TableRow key={s.secret_name}>
                        <TableCell className="font-mono text-xs">{s.secret_name}</TableCell>
                        <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                        <TableCell>{s.is_critical ? <Badge variant="destructive">Sim</Badge> : "—"}</TableCell>
                        <TableCell>{s.rotation_interval_days}d</TableCell>
                        <TableCell className="text-xs">{last ? last.toLocaleDateString() : "Nunca"}</TableCell>
                        <TableCell>{due ? <Badge variant="destructive">Vencido</Badge> : <Badge>OK</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deps">
          <Card>
            <CardHeader><CardTitle>Vulnerabilidades de dependências</CardTitle></CardHeader>
            <CardContent>
              {deps.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Nenhuma vulnerabilidade aberta. Execute scan via API.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Pacote</TableHead><TableHead>Versão</TableHead><TableHead>Sev</TableHead>
                    <TableHead>Recomendação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {deps.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.package_name}</TableCell>
                        <TableCell className="text-xs">{d.installed_version ?? "-"}</TableCell>
                        <TableCell><Badge variant={sevColor(d.severity)}>{d.severity}</Badge></TableCell>
                        <TableCell className="text-xs">{d.recommendation ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forensic">
          <Card>
            <CardHeader><CardTitle>Snapshot forense</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="user_id (uuid)" value={forUser} onChange={e => setForUser(e.target.value)} />
                <Input placeholder="horas" value={forHours} onChange={e => setForHours(e.target.value)} className="w-24" />
                <Button onClick={runForensic}>Gerar</Button>
                {forResult && <Button variant="outline" onClick={downloadSnapshot}>Download JSON</Button>}
              </div>
              {forResult && (
                <div className="bg-muted p-4 rounded text-xs font-mono max-h-96 overflow-auto">
                  <p className="mb-2 text-muted-foreground">Hash de integridade: <span className="text-foreground">{forResult.integrity_hash}</span></p>
                  <pre>{JSON.stringify(forResult.snapshot, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
