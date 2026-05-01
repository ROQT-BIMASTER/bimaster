import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, BellRing, Play, CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Rule = {
  id: string;
  rule_key: string;
  name: string;
  description: string | null;
  metric: string;
  comparison: "lt" | "lte" | "gt" | "gte" | "eq";
  threshold: number;
  severity: "info" | "warn" | "high" | "critical";
  cooldown_minutes: number;
  enabled: boolean;
  last_triggered_at: string | null;
};

type Alert = {
  id: string;
  rule_key: string;
  metric: string;
  observed_value: number;
  threshold: number;
  severity: string;
  message: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
};

const FN_URL = "https://aokkyrgaqjarhlywhjju.functions.supabase.co/security-alerts";

const sevColor = (s: string) =>
  ({ critical: "destructive", high: "destructive", warn: "secondary", info: "outline" }[s] ?? "outline") as any;

const COMP_LABEL: Record<Rule["comparison"], string> = {
  lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=",
};

const METRIC_LABEL: Record<string, string> = {
  mfa_coverage_pct: "Cobertura MFA (%)",
  waf_shadow_24h: "Eventos WAF shadow (24h)",
  anomalies_24h: "Anomalias (24h)",
  anomalies_high_24h: "Anomalias high+ (24h)",
  quarantined_active: "Contas em quarentena",
  open_dep_findings: "CVEs abertos",
  secrets_due_rotation: "Segredos vencidos",
  pentest_score: "Pentest score (%)",
};

async function call(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${FN_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function SecurityAlertsPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [edits, setEdits] = useState<Record<string, { threshold?: number; cooldown_minutes?: number }>>({});

  const reload = async () => {
    setLoading(true);
    try {
      const data = await call("?op=list");
      setRules(data.rules);
      setAlerts(data.alerts);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  const evaluateNow = async () => {
    setEvaluating(true);
    try {
      const r = await call("?op=evaluate", { method: "POST" });
      toast.success(`Avaliação concluída: ${r.alerts_triggered} alerta(s) disparado(s) de ${r.rules_evaluated} regra(s)`);
      await reload();
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    } finally { setEvaluating(false); }
  };

  const updateRule = async (id: string, patch: Partial<Pick<Rule, "threshold" | "cooldown_minutes" | "enabled" | "severity">>) => {
    try {
      await call("?op=update_rule", { method: "POST", body: JSON.stringify({ id, ...patch }) });
      toast.success("Regra atualizada");
      setEdits((e) => ({ ...e, [id]: {} }));
      await reload();
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    }
  };

  const acknowledge = async (id: string) => {
    try {
      await call("?op=acknowledge", { method: "POST", body: JSON.stringify({ id }) });
      await reload();
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    }
  };

  const unackCount = alerts.filter((a) => !a.acknowledged).length;
  const last24h = alerts.filter((a) => Date.now() - new Date(a.created_at).getTime() < 86400_000).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <BellRing className={cn("h-5 w-5", unackCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
          <div>
            <h3 className="text-lg font-semibold">Alertas automáticos</h3>
            <p className="text-xs text-muted-foreground">
              Avaliação a cada 15 minutos · {unackCount} pendente(s) · {last24h} nas últimas 24h
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Recarregar
          </Button>
          <Button size="sm" onClick={evaluateNow} disabled={evaluating}>
            <Play className="h-4 w-4 mr-2" /> {evaluating ? "Avaliando..." : "Avaliar agora"}
          </Button>
        </div>
      </div>

      {/* Active alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive" />
            Alertas recentes (100)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhum alerta disparado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Sev</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead className="text-right">Observado</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id} className={cn(!a.acknowledged && "bg-destructive/5")}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={sevColor(a.severity)}>{a.severity}</Badge></TableCell>
                    <TableCell className="text-sm">{a.message}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{a.observed_value}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{a.threshold}</TableCell>
                    <TableCell>
                      {a.acknowledged ? (
                        <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />OK</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!a.acknowledged && (
                        <Button size="sm" variant="ghost" onClick={() => acknowledge(a.id)}>Reconhecer</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Regras de alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regra</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-center">Condição</TableHead>
                <TableHead className="w-28">Limite</TableHead>
                <TableHead className="w-28">Cooldown (min)</TableHead>
                <TableHead>Sev</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead>Último disparo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => {
                const edit = edits[r.id] ?? {};
                const dirty = edit.threshold !== undefined || edit.cooldown_minutes !== undefined;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    </TableCell>
                    <TableCell className="text-xs">{METRIC_LABEL[r.metric] ?? r.metric}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{COMP_LABEL[r.comparison]}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={r.threshold}
                        className="h-8"
                        onChange={(e) => setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], threshold: Number(e.target.value) } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={10080}
                        defaultValue={r.cooldown_minutes}
                        className="h-8"
                        onChange={(e) => setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], cooldown_minutes: Number(e.target.value) } }))}
                      />
                    </TableCell>
                    <TableCell><Badge variant={sevColor(r.severity)}>{r.severity}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.enabled} onCheckedChange={(v) => updateRule(r.id, { enabled: v })} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "ghost"}
                        disabled={!dirty}
                        onClick={() => updateRule(r.id, edit)}
                      >
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
