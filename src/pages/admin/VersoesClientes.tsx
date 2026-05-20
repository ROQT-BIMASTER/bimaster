/**
 * Admin — Versões dos Clientes & Kill Switch de Release
 *
 * Duas seções:
 * 1. Pinagem de versão mínima (Fase 4): admin força clientes conectados a
 *    receberem o toast "Nova versão disponível" via Realtime.
 * 2. Telemetria de versão (Fase 3): mostra qual `APP_VERSION` cada usuário
 *    está rodando, com agrupamento por versão.
 *
 * Ambas as ações destrutivas exigem reconfirmação por senha (`AdminPasswordDialog`).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AdminPasswordDialog } from "@/components/configuracoes/AdminPasswordDialog";
import { APP_VERSION } from "@/lib/version";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TelemetryRow {
  user_id: string;
  app_version: string;
  user_agent: string | null;
  last_seen: string;
}

interface ReleasePin {
  id: string;
  min_version: string;
  mensagem: string | null;
  criado_em: string;
  criado_por: string;
}

export default function VersoesClientes() {
  const { toast } = useToast();
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [pins, setPins] = useState<ReleasePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [minVersion, setMinVersion] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tel, pin] = await Promise.all([
      supabase
        .from("client_version_telemetry")
        .select("user_id, app_version, user_agent, last_seen")
        .order("last_seen", { ascending: false })
        .limit(500),
      supabase
        .from("app_release_pins")
        .select("id, min_version, mensagem, criado_em, criado_por")
        .order("criado_em", { ascending: false })
        .limit(20),
    ]);
    if (tel.error) toast({ title: "Erro ao carregar telemetria", description: tel.error.message, variant: "destructive" });
    if (pin.error) toast({ title: "Erro ao carregar pins", description: pin.error.message, variant: "destructive" });
    setTelemetry((tel.data as TelemetryRow[]) ?? []);
    setPins((pin.data as ReleasePin[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const versionGroups = useMemo(() => {
    const groups = new Map<string, number>();
    telemetry.forEach((row) => groups.set(row.app_version, (groups.get(row.app_version) ?? 0) + 1));
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  }, [telemetry]);

  const handleConfirmedSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("app_release_pins").insert({
      min_version: minVersion.trim(),
      mensagem: mensagem.trim() || null,
      criado_por: user.id,
    });
    if (error) {
      toast({ title: "Falha ao registrar pin", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pin registrado", description: `Clientes < ${minVersion} receberão o aviso de atualização.` });
    setMinVersion("");
    setMensagem("");
    void load();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Versões dos clientes</h1>
        <p className="text-sm text-muted-foreground">
          Versão atual deste build: <Badge variant="outline">{APP_VERSION}</Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forçar atualização (kill switch)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ao registrar um pin, todos os clientes conectados com versão menor que <code>min_version</code> receberão
            imediatamente o aviso "Nova versão disponível" (requer flag <code>pwa_heartbeat_enabled</code> ativa no cliente).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_version">Versão mínima exigida</Label>
              <Input
                id="min_version"
                placeholder="3.4.94"
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem (opcional)</Label>
              <Textarea
                id="mensagem"
                placeholder="Correção crítica no módulo China."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <Button
            onClick={() => setPasswordOpen(true)}
            disabled={!/^\d+\.\d+\.\d+$/.test(minVersion.trim())}
          >
            Registrar pin
          </Button>

          {pins.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Histórico recente</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versão mínima</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pins.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><Badge>{p.min_version}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.mensagem ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {formatDistanceToNow(new Date(p.criado_em), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribuição de versões ({telemetry.length} clientes recentes)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-2">
              {versionGroups.map(([ver, count]) => (
                <div key={ver} className="flex items-center justify-between p-2 rounded border">
                  <Badge variant={ver === APP_VERSION ? "default" : "outline"}>{ver}</Badge>
                  <span className="text-sm tabular-nums">{count} usuário(s)</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos heartbeats</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead>Último visto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {telemetry.slice(0, 100).map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell className="font-mono text-xs">{row.user_id.slice(0, 8)}…</TableCell>
                  <TableCell>
                    <Badge variant={row.app_version === APP_VERSION ? "default" : "outline"}>
                      {row.app_version}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {row.user_agent ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDistanceToNow(new Date(row.last_seen), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdminPasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onSuccess={() => { void handleConfirmedSubmit(); }}
      />
    </div>
  );
}
