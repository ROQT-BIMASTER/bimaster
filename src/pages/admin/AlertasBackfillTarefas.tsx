import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  History,
  Save,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

type Config = {
  id: string;
  enabled: boolean;
  threshold_orfas: number;
  cooldown_minutes: number;
  notify_admins: boolean;
  extra_recipient_ids: string[];
  updated_at: string | null;
  updated_by: string | null;
};

type AlertRow = {
  id: string;
  triggered_at: string;
  alert_type: "threshold_exceeded" | "error";
  source: string | null;
  orfas_count: number;
  threshold_used: number | null;
  recipients_count: number;
  details: any;
};

type Profile = { id: string; nome: string | null; email: string | null };

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return d;
  }
}

export default function AlertasBackfillTarefas() {
  const qc = useQueryClient();

  // ---------------- Queries ----------------
  const configQuery = useQuery({
    queryKey: ["backfill-alert-config"],
    queryFn: async (): Promise<Config | null> => {
      const { data, error } = await supabase.rpc("backfill_alert_config_get" as any);
      if (error) throw error;
      const arr = (data as Config[] | null) ?? [];
      return arr[0] ?? null;
    },
  });

  const alertsQuery = useQuery({
    queryKey: ["backfill-alerts-listar"],
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await supabase.rpc("backfill_alerts_listar" as any, {
        p_limit: 100,
      } as any);
      if (error) throw error;
      return (data as AlertRow[] | null) ?? [];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles-for-alert-recipients"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome");
      if (error) throw error;
      return (data as Profile[] | null) ?? [];
    },
  });

  // ---------------- Local state mirrors config ----------------
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState<number>(50);
  const [cooldown, setCooldown] = useState<number>(360);
  const [notifyAdmins, setNotifyAdmins] = useState(true);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);

  useEffect(() => {
    const c = configQuery.data;
    if (!c) return;
    setEnabled(c.enabled);
    setThreshold(c.threshold_orfas);
    setCooldown(c.cooldown_minutes);
    setNotifyAdmins(c.notify_admins);
    setExtraIds(c.extra_recipient_ids ?? []);
  }, [configQuery.data?.id, configQuery.data?.updated_at]);

  // ---------------- Mutation ----------------
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("backfill_alert_config_update" as any, {
        p_enabled: enabled,
        p_threshold_orfas: threshold,
        p_cooldown_minutes: cooldown,
        p_notify_admins: notifyAdmins,
        p_extra_recipient_ids: extraIds,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração de alerta salva");
      qc.invalidateQueries({ queryKey: ["backfill-alert-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const isAdminError =
    (configQuery.error as any)?.message?.includes("Acesso negado") ||
    (alertsQuery.error as any)?.message?.includes("Acesso negado");

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    (profilesQuery.data ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [profilesQuery.data]);

  const dirty = useMemo(() => {
    const c = configQuery.data;
    if (!c) return false;
    return (
      c.enabled !== enabled ||
      c.threshold_orfas !== threshold ||
      c.cooldown_minutes !== cooldown ||
      c.notify_admins !== notifyAdmins ||
      JSON.stringify((c.extra_recipient_ids ?? []).slice().sort()) !==
        JSON.stringify(extraIds.slice().sort())
    );
  }, [configQuery.data, enabled, threshold, cooldown, notifyAdmins, extraIds]);

  const lastAlert = alertsQuery.data?.[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Alertas — Backfill de tarefas
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Configure quando administradores devem ser notificados pelo job{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                backfill_data_conclusao_tarefas
              </code>
              : quando o número de tarefas órfãs ultrapassar o limite ou quando a
              execução falhar. Tela restrita a administradores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/historico-backfill-tarefas">
                <History className="h-3.5 w-3.5" />
                Histórico do job
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/diagnostico-tarefas-data-conclusao">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Diagnóstico
              </Link>
            </Button>
          </div>
        </div>

        {isAdminError ? (
          <Card className="border-destructive/40">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Acesso negado</p>
                <p className="text-sm text-muted-foreground">
                  Esta tela é restrita a administradores.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Config card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  Regras de alerta
                </CardTitle>
                <CardDescription>
                  Os alertas são enviados como notificações in-app (com toast e
                  push, quando ativo) para administradores e destinatários extras
                  selecionados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {configQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Toggle global */}
                    <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/20 p-4">
                      <div>
                        <Label htmlFor="alert-enabled" className="text-sm font-medium">
                          Alertas ativos
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Quando desativado, nenhum alerta é gerado, mesmo se o limite for excedido.
                        </p>
                      </div>
                      <Switch
                        id="alert-enabled"
                        checked={enabled}
                        onCheckedChange={setEnabled}
                      />
                    </div>

                    {/* Threshold + cooldown */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="threshold" className="text-sm">
                          Limite de tarefas órfãs
                        </Label>
                        <Input
                          id="threshold"
                          type="number"
                          min={0}
                          step={1}
                          value={threshold}
                          onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
                          disabled={!enabled}
                        />
                        <p className="text-xs text-muted-foreground">
                          Dispara quando o job detecta ≥ este número de tarefas concluídas
                          sem <code className="text-[10px]">data_conclusao</code>.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cooldown" className="text-sm">
                          Cooldown (minutos)
                        </Label>
                        <Input
                          id="cooldown"
                          type="number"
                          min={0}
                          step={5}
                          value={cooldown}
                          onChange={(e) => setCooldown(Math.max(0, Number(e.target.value) || 0))}
                          disabled={!enabled}
                        />
                        <p className="text-xs text-muted-foreground">
                          Intervalo mínimo entre alertas do mesmo tipo (evita spam). Padrão: 360 (6h).
                        </p>
                      </div>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 p-4">
                        <div>
                          <Label htmlFor="notify-admins" className="text-sm font-medium">
                            Notificar todos os administradores
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Envia o alerta para todos os usuários com a role <Badge variant="outline" className="ml-1 font-mono text-[10px]">admin</Badge>.
                          </p>
                        </div>
                        <Switch
                          id="notify-admins"
                          checked={notifyAdmins}
                          onCheckedChange={setNotifyAdmins}
                          disabled={!enabled}
                        />
                      </div>

                      <div>
                        <Label className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Destinatários extras
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                          Usuários adicionais que devem receber o alerta, mesmo que não sejam administradores.
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                          {extraIds.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">
                              Nenhum destinatário extra.
                            </span>
                          ) : (
                            extraIds.map((id) => {
                              const p = profilesById.get(id);
                              return (
                                <Badge
                                  key={id}
                                  variant="secondary"
                                  className="gap-1 pr-1"
                                >
                                  <span className="text-xs">
                                    {p?.nome ?? p?.email ?? id.slice(0, 8)}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="Remover"
                                    className="rounded-sm hover:bg-muted-foreground/10 p-0.5"
                                    disabled={!enabled}
                                    onClick={() =>
                                      setExtraIds((s) => s.filter((x) => x !== id))
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })
                          )}
                        </div>

                        <Popover open={recipientPickerOpen} onOpenChange={setRecipientPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={!enabled || profilesQuery.isLoading}
                            >
                              + Adicionar destinatário
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[320px]" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar por nome ou email…" />
                              <CommandList>
                                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {(profilesQuery.data ?? [])
                                    .filter((p) => !extraIds.includes(p.id))
                                    .slice(0, 200)
                                    .map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={`${p.nome ?? ""} ${p.email ?? ""}`}
                                        onSelect={() => {
                                          setExtraIds((s) => [...s, p.id]);
                                          setRecipientPickerOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-sm">{p.nome ?? "—"}</span>
                                          {p.email && (
                                            <span className="text-[11px] text-muted-foreground">
                                              {p.email}
                                            </span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Save */}
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="text-xs text-muted-foreground">
                        {configQuery.data?.updated_at
                          ? `Última atualização: ${fmtDate(configQuery.data.updated_at)}`
                          : "Sem alterações registradas."}
                      </div>
                      <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={!dirty || saveMutation.isPending}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saveMutation.isPending ? "Salvando…" : "Salvar"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Status card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {enabled ? (
                    <Bell className="h-4 w-4 text-success" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  Estado atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Alertas
                    </p>
                    <p className="text-lg font-semibold mt-1">
                      {enabled ? "Ativos" : "Desativados"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Limite atual
                    </p>
                    <p className="text-lg font-semibold mt-1 tabular-nums">
                      ≥ {threshold}{" "}
                      <span className="text-xs font-normal text-muted-foreground">tarefa(s)</span>
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Último alerta
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {lastAlert ? fmtDate(lastAlert.triggered_at) : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Histórico de alertas disparados
                </CardTitle>
                <CardDescription>
                  Últimos {alertsQuery.data?.length ?? 0} alertas registrados (limite: 100).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alertsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : (alertsQuery.data ?? []).length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum alerta disparado até agora. Tudo dentro dos limites configurados.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Disparado em</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Órfãs</TableHead>
                          <TableHead className="text-right">Limite</TableHead>
                          <TableHead className="text-right">Destinatários</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(alertsQuery.data ?? []).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">
                              {fmtDate(row.triggered_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={row.alert_type === "error" ? "destructive" : "default"}
                                className="font-mono text-[10px]"
                              >
                                {row.alert_type === "error" ? "falha" : "limite excedido"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.source ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">
                              {row.orfas_count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {row.threshold_used ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.recipients_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
