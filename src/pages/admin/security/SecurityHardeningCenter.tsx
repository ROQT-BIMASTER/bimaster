import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useStepUp } from "@/hooks/useStepUp";
import { StepUpDialog } from "@/components/security/StepUpDialog";

type Kpis = {
  window_hours: number;
  events_total: number;
  events_by_type: Record<string, number>;
  events_by_severity: Record<string, number>;
  accounts_quarantined: number;
};

type Invariant = { check_name: string; status: string; details: string };
type Event = { id: number; occurred_at: string; event_type: string; severity: string; user_id: string | null; ip: string | null; resource: string | null; details: any };
type Quar = { user_id: string; reason: string; quarantined_at: string; expires_at: string | null };

async function call(op: string, body?: any, stepUpToken?: string) {
  const url = `https://aokkyrgaqjarhlywhjju.functions.supabase.co/security-admin${body ? "" : `?op=${op}`}`;
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  };
  if (stepUpToken) headers["x-step-up-token"] = stepUpToken;
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify({ op, ...body }) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Falha");
  return j;
}

export default function SecurityHardeningCenter() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [inv, setInv] = useState<Invariant[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [quar, setQuar] = useState<Quar[]>([]);
  const [loading, setLoading] = useState(false);
  const { request: requestStepUp, dialogProps } = useStepUp();

  // Quarentena
  const [qUser, setQUser] = useState("");
  const [qReason, setQReason] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const [k, i, e, q] = await Promise.all([
        call("kpis"),
        call("invariants"),
        call("events"),
        call("quarantined"),
      ]);
      setKpis(k);
      setInv(i.checks ?? []);
      setEvents(e.events ?? []);
      setQuar(q.accounts ?? []);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function quarantine() {
    if (!qUser || !qReason) return toast.error("Preencha user_id e motivo");
    const token = await requestStepUp("security.admin.config", `Confirme para colocar a conta ${qUser} em quarentena`);
    if (!token) return;
    try {
      await call("quarantine", { user_id: qUser, reason: qReason }, token);
      toast.success("Conta colocada em quarentena");
      setQUser(""); setQReason("");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function release(userId: string) {
    const token = await requestStepUp("security.admin.config", `Confirme para liberar a conta ${userId}`);
    if (!token) return;
    try {
      await call("release", { user_id: userId }, token);
      toast.success("Conta liberada");
      refresh();
    } catch (err: any) { toast.error(err.message); }
  }

  async function verifyChain() {
    const token = await requestStepUp("security.admin.config", "Confirme para verificar a integridade da cadeia de auditoria");
    if (!token) return;
    try {
      const r = await call("verify_chain", { limit: 5000 }, token);
      if ((r.broken ?? []).length === 0) toast.success("Cadeia de auditoria íntegra");
      else toast.error(`Quebra detectada em ${r.broken.length} registros`);
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Centro de Endurecimento (Hardening)
          </h1>
          <p className="text-muted-foreground mt-1">
            Camadas profundas de segurança: SIEM, auditoria imutável, quarentena e invariantes do banco.
          </p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Eventos (24h)" value={kpis?.events_total ?? 0} icon={<ShieldAlert />} />
        <KpiCard label="Críticos (24h)" value={kpis?.events_by_severity?.critical ?? 0} tone="destructive" />
        <KpiCard label="Avisos (24h)" value={kpis?.events_by_severity?.warn ?? 0} tone="warn" />
        <KpiCard label="Contas em quarentena" value={kpis?.accounts_quarantined ?? 0} icon={<ShieldOff />} tone={kpis && kpis.accounts_quarantined > 0 ? "destructive" : undefined} />
      </div>

      <Tabs defaultValue="invariants">
        <TabsList>
          <TabsTrigger value="invariants">Invariantes</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="quarantine">Quarentena</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="invariants" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Invariantes do banco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inv.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
              {inv.map((i) => (
                <div key={i.check_name} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="font-mono text-sm">{i.check_name}</p>
                    {i.details && <p className="text-xs text-muted-foreground mt-1 truncate max-w-[60ch]">{i.details}</p>}
                  </div>
                  <Badge variant={i.status === "OK" ? "default" : "destructive"} className="gap-1">
                    {i.status === "OK" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {i.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader><CardTitle>Últimos 200 eventos</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left">
                  <tr className="border-b">
                    <th className="p-2">Quando</th><th className="p-2">Tipo</th><th className="p-2">Sev</th>
                    <th className="p-2">User</th><th className="p-2">IP</th><th className="p-2">Recurso</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-muted/40">
                      <td className="p-2 whitespace-nowrap">{new Date(e.occurred_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{e.event_type}</td>
                      <td className="p-2">
                        <Badge variant={e.severity === "critical" || e.severity === "error" ? "destructive" : "outline"}>
                          {e.severity}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono">{e.user_id?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2 font-mono">{e.ip ?? "—"}</td>
                      <td className="p-2">{e.resource ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarantine" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Colocar conta em quarentena</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">User ID (UUID)</label>
                <Input value={qUser} onChange={(e) => setQUser(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Motivo</label>
                <Textarea value={qReason} onChange={(e) => setQReason(e.target.value)} placeholder="Ex: comportamento anômalo detectado" />
              </div>
              <Button onClick={quarantine} variant="destructive">
                <ShieldOff className="h-4 w-4 mr-2" />
                Colocar em quarentena
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contas atualmente bloqueadas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {quar.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta em quarentena.</p>}
              {quar.map((a) => (
                <div key={a.user_id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="font-mono text-xs">{a.user_id}</p>
                    <p className="text-xs text-muted-foreground">{a.reason}</p>
                    <p className="text-xs text-muted-foreground">desde {new Date(a.quarantined_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => release(a.user_id)}>Liberar</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Auditoria imutável (hash chain)</CardTitle>
                <Button size="sm" variant="outline" onClick={verifyChain}>Verificar integridade</Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Cada registro está encadeado por SHA-256 ao anterior. Qualquer alteração quebra a cadeia.
              </p>
              <p className="text-xs text-muted-foreground">
                Use a aba "Auditoria detalhada" do sistema legado para inspeção completa.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <StepUpDialog {...dialogProps} />
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone?: "destructive" | "warn" }) {
  const color = tone === "destructive" ? "text-destructive" : tone === "warn" ? "text-yellow-600" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
