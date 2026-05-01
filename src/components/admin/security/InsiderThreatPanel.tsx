import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldAlert, Users, Download, FileWarning, Clock, RefreshCw, CheckCircle2, XCircle, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const FN_URL = "https://aokkyrgaqjarhlywhjju.functions.supabase.co/insider-threat";

type Metrics = {
  high_risk_users: number;
  untrusted_devices_active: number;
  jit_pending: number;
  jit_active: number;
  honeytoken_hits_30d: number;
  massive_exports_7d: number;
  quarantined_active: number;
  access_review_pending: number;
  top_risk_users: Array<{ user_id: string; score: number; risk_level: string }>;
};

async function call(op: string, body?: any, method: "GET" | "POST" = "GET", qs?: Record<string, string>) {
  const url = new URL(FN_URL);
  url.searchParams.set("op", op);
  if (qs) Object.entries(qs).forEach(([k, v]) => url.searchParams.set(k, v));
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify({ op, ...(body ?? {}) }) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const sevBadge = (s: string) => {
  const v = ({ critical: "destructive", high: "destructive", medium: "secondary", low: "outline" } as const)[s] ?? "outline";
  return <Badge variant={v as any}>{s}</Badge>;
};

export default function InsiderThreatPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);

  const [jit, setJit] = useState<any[]>([]);
  const [reviews, setReviews] = useState<{ cycles: any[]; items: any[]; current_cycle_id: string | null }>({ cycles: [], items: [], current_cycle_id: null });
  const [exports, setExports] = useState<any[]>([]);
  const [hits, setHits] = useState<any[]>([]);

  const [decideDialog, setDecideDialog] = useState<{ open: boolean; item?: any; kind?: "jit" | "review" }>({ open: false });
  const [decisionReason, setDecisionReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, j, r, e, h] = await Promise.all([
        call("metrics"),
        call("jit_list", undefined, "GET", { status: "pending" }),
        call("reviews_list"),
        call("exports_recent"),
        call("honey_hits"),
      ]);
      setMetrics(m);
      setJit(j.items ?? []);
      setReviews(r);
      setExports(e.items ?? []);
      setHits(h.items ?? []);
    } catch (err: any) {
      toast.error("Falha ao carregar métricas: " + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleJitDecide = async (decision: "approved" | "denied") => {
    if (!decideDialog.item) return;
    try {
      await call("jit_decide", { request_id: decideDialog.item.id, decision, reason: decisionReason }, "POST");
      toast.success(`Solicitação ${decision === "approved" ? "aprovada" : "negada"}`);
      setDecideDialog({ open: false });
      setDecisionReason("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  };

  const handleReviewDecide = async (decision: "keep" | "revoke" | "downgrade") => {
    if (!decideDialog.item) return;
    try {
      await call("review_decide", { item_id: decideDialog.item.id, decision, notes: decisionReason }, "POST");
      toast.success("Decisão registrada");
      setDecideDialog({ open: false });
      setDecisionReason("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  };

  const openReviewCycle = async () => {
    try {
      await call("review_open", {}, "POST");
      toast.success("Ciclo de revisão aberto (90 dias)");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  };

  const seedHoney = async () => {
    try {
      const r = await call("seed_honeytokens", {}, "POST");
      toast.success(`Honeytokens plantados: ${r.seeded_municipios ?? 0}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Insider Threat</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={seedHoney}>
            <Plus className="h-4 w-4 mr-1" /> Plantar honeytokens
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI title="Usuários alto risco" value={metrics?.high_risk_users ?? 0} icon={<Users className="h-4 w-4" />} tone={metrics && metrics.high_risk_users > 0 ? "danger" : "default"} />
        <KPI title="JIT pendentes" value={metrics?.jit_pending ?? 0} icon={<Clock className="h-4 w-4" />} tone={metrics && metrics.jit_pending > 0 ? "warn" : "default"} />
        <KPI title="JIT ativos" value={metrics?.jit_active ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KPI title="Honeytokens (30d)" value={metrics?.honeytoken_hits_30d ?? 0} icon={<FileWarning className="h-4 w-4" />} tone={metrics && metrics.honeytoken_hits_30d > 0 ? "danger" : "default"} />
        <KPI title="Exports massivos (7d)" value={metrics?.massive_exports_7d ?? 0} icon={<Download className="h-4 w-4" />} tone={metrics && metrics.massive_exports_7d > 5 ? "warn" : "default"} />
        <KPI title="Quarentenados" value={metrics?.quarantined_active ?? 0} icon={<AlertTriangle className="h-4 w-4" />} tone={metrics && metrics.quarantined_active > 0 ? "danger" : "default"} />
        <KPI title="Dispositivos não-confiáveis" value={metrics?.untrusted_devices_active ?? 0} icon={<ShieldAlert className="h-4 w-4" />} tone={metrics && metrics.untrusted_devices_active > 5 ? "warn" : "default"} />
        <KPI title="Revisão pendente" value={metrics?.access_review_pending ?? 0} icon={<Users className="h-4 w-4" />} tone={metrics && metrics.access_review_pending > 0 ? "warn" : "default"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Top risco</TabsTrigger>
          <TabsTrigger value="jit">JIT Access ({jit.length})</TabsTrigger>
          <TabsTrigger value="reviews">Access Review</TabsTrigger>
          <TabsTrigger value="exports">Exports recentes</TabsTrigger>
          <TabsTrigger value="honey">Honeytoken hits</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle className="text-sm">Top 10 usuários por risco</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>User ID</TableHead><TableHead>Score</TableHead><TableHead>Nível</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(metrics?.top_risk_users ?? []).map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
                      <TableCell>{u.score}</TableCell>
                      <TableCell>{sevBadge(u.risk_level)}</TableCell>
                    </TableRow>
                  ))}
                  {(metrics?.top_risk_users ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Sem usuários com risco calculado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jit">
          <Card>
            <CardHeader><CardTitle className="text-sm">Solicitações JIT pendentes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Solicitante</TableHead><TableHead>Escopo</TableHead><TableHead>Justificativa</TableHead>
                    <TableHead>Min</TableHead><TableHead>4-eyes</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jit.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.requester_id?.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{r.scope}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate" title={r.justification}>{r.justification}</TableCell>
                      <TableCell>{r.requested_minutes}</TableCell>
                      <TableCell>{r.requires_four_eyes ? <Badge variant="destructive">SIM</Badge> : <Badge variant="outline">não</Badge>}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setDecideDialog({ open: true, item: r, kind: "jit" })}>Decidir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jit.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Nenhuma solicitação pendente</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Revisão de acesso (admin/gerente)</CardTitle>
              <Button size="sm" onClick={openReviewCycle}><Plus className="h-4 w-4 mr-1" /> Abrir novo ciclo</Button>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-2">
                Ciclo atual: <span className="font-mono">{reviews.current_cycle_id ?? "—"}</span>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Role</TableHead><TableHead>Decisão</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {reviews.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.target_user_id?.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{it.current_role_name}</Badge></TableCell>
                      <TableCell>{it.decision ? <Badge>{it.decision}</Badge> : <Badge variant="secondary">pendente</Badge>}</TableCell>
                      <TableCell>
                        {!it.decision && (
                          <Button size="sm" variant="outline" onClick={() => setDecideDialog({ open: true, item: it, kind: "review" })}>Decidir</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {reviews.items.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Nenhum ciclo aberto</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports">
          <Card>
            <CardHeader><CardTitle className="text-sm">Exportações recentes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead><TableHead>Usuário</TableHead><TableHead>Escopo</TableHead>
                    <TableHead>Linhas</TableHead><TableHead>Formato</TableHead><TableHead>IP</TableHead><TableHead>Massivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((r) => (
                    <TableRow key={r.id} className={r.is_massive ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{r.scope}</Badge></TableCell>
                      <TableCell>{r.row_count?.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{r.file_format}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ip_address ?? "—"}</TableCell>
                      <TableCell>{r.is_massive ? <Badge variant="destructive">SIM</Badge> : <Badge variant="outline">não</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {exports.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm">Sem exports</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="honey">
          <Card>
            <CardHeader><CardTitle className="text-sm">Acessos a honeytokens (alerta crítico)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Quando</TableHead><TableHead>Usuário</TableHead><TableHead>Tabela</TableHead><TableHead>Entidade</TableHead><TableHead>Contexto</TableHead><TableHead>IP</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {hits.map((r) => (
                    <TableRow key={r.id} className="bg-destructive/10">
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8) ?? "—"}…</TableCell>
                      <TableCell>{r.entity_table}</TableCell>
                      <TableCell className="font-mono text-xs">{r.entity_id}</TableCell>
                      <TableCell><Badge variant="destructive">{r.hit_context}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.ip_address ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {hits.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Nenhum acesso a honeytoken — bom sinal</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Decision Dialog */}
      <Dialog open={decideDialog.open} onOpenChange={(o) => !o && setDecideDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decideDialog.kind === "jit" ? "Decidir solicitação JIT" : "Decisão de revisão de acesso"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {decideDialog.kind === "jit" && decideDialog.item && (
              <div className="text-sm">
                <div><strong>Escopo:</strong> {decideDialog.item.scope}</div>
                <div><strong>Justificativa:</strong> {decideDialog.item.justification}</div>
                <div><strong>Duração:</strong> {decideDialog.item.requested_minutes} min</div>
                {decideDialog.item.requires_four_eyes && (
                  <div className="text-destructive font-medium mt-2">Esta ação exige 4-eyes (você precisa ser admin distinto do solicitante).</div>
                )}
              </div>
            )}
            <Textarea
              placeholder="Motivo / observação (obrigatório)"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            {decideDialog.kind === "jit" ? (
              <>
                <Button variant="destructive" onClick={() => handleJitDecide("denied")} disabled={!decisionReason}>
                  <XCircle className="h-4 w-4 mr-1" /> Negar
                </Button>
                <Button onClick={() => handleJitDecide("approved")} disabled={!decisionReason}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleReviewDecide("keep")}>Manter</Button>
                <Button variant="secondary" onClick={() => handleReviewDecide("downgrade")}>Rebaixar</Button>
                <Button variant="destructive" onClick={() => handleReviewDecide("revoke")}>Revogar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ title, value, icon, tone = "default" }: { title: string; value: number; icon: React.ReactNode; tone?: "default" | "warn" | "danger" }) {
  const toneCls = tone === "danger" ? "border-destructive/50 bg-destructive/5" : tone === "warn" ? "border-warning/50 bg-warning/5" : "";
  return (
    <Card className={toneCls}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{title}</div>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
