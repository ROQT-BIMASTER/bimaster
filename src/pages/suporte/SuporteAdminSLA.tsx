import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { Zap } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CalendarDays, Save, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { SUPORTE_PRIORIDADE_LABEL, type SuportePrioridade } from "@/hooks/suporte/types";

const PRIORIDADES: SuportePrioridade[] = ["baixa", "media", "alta", "critica"];

// ---------------- Types ----------------

interface Fila {
  id: string;
  nome: string;
  sla_primeira_resposta_horas: number;
  sla_resolucao_horas: number;
  calendario_id: string | null;
}

interface Calendario {
  id: string;
  nome: string;
  timezone: string;
  intervalos: any; // jsonb: { seg: [["09:00","18:00"]], ter: [...], ... }
  feriados: string[]; // date[]
  is_default: boolean;
  ativo: boolean;
}

interface SlaPolicy {
  id?: string;
  fila_id: string;
  prioridade: SuportePrioridade;
  primeira_resposta_horas: number;
  resolucao_horas: number;
  usa_horario_comercial: boolean;
}

const DIAS: { key: string; label: string }[] = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

// ---------------- Page ----------------

export default function SuporteAdminSLA() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();
  const abaInicial = (searchParams.get("tab") === "macros" ? "macros" : "matriz") as
    | "matriz"
    | "calendarios"
    | "macros";

  const { data: filas = [], isLoading: filasLoading } = useQuery({
    queryKey: ["suporte-admin", "filas"],
    queryFn: async (): Promise<Fila[]> => {
      const { data, error } = await (supabase as any)
        .from("suporte_filas")
        .select("id, nome, sla_primeira_resposta_horas, sla_resolucao_horas, calendario_id")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: calendarios = [] } = useQuery({
    queryKey: ["suporte-admin", "calendarios"],
    queryFn: async (): Promise<Calendario[]> => {
      const { data, error } = await (supabase as any)
        .from("suporte_calendarios")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ["suporte-admin", "policies"],
    queryFn: async (): Promise<SlaPolicy[]> => {
      const { data, error } = await (supabase as any)
        .from("suporte_sla_policies")
        .select("id, fila_id, prioridade, primeira_resposta_horas, resolucao_horas, usa_horario_comercial");
      if (error) throw error;
      return (data ?? []) as SlaPolicy[];
    },
    enabled: isAdmin,
  });

  const [filaSel, setFilaSel] = useState<string>("");
  useEffect(() => {
    if (!filaSel && filas.length > 0) setFilaSel(filas[0].id);
  }, [filas, filaSel]);

  const filaObj = filas.find((f) => f.id === filaSel);

  // Matriz local de políticas da fila selecionada
  const [matriz, setMatriz] = useState<Record<SuportePrioridade, SlaPolicy>>(() =>
    PRIORIDADES.reduce((acc, p) => {
      acc[p] = {
        fila_id: "",
        prioridade: p,
        primeira_resposta_horas: 4,
        resolucao_horas: 24,
        usa_horario_comercial: true,
      };
      return acc;
    }, {} as Record<SuportePrioridade, SlaPolicy>),
  );

  useEffect(() => {
    if (!filaObj) return;
    const next: Record<SuportePrioridade, SlaPolicy> = { ...matriz };
    for (const p of PRIORIDADES) {
      const existing = policies.find((x) => x.fila_id === filaObj.id && x.prioridade === p);
      next[p] = existing ?? {
        fila_id: filaObj.id,
        prioridade: p,
        primeira_resposta_horas: filaObj.sla_primeira_resposta_horas,
        resolucao_horas: filaObj.sla_resolucao_horas,
        usa_horario_comercial: true,
      };
    }
    setMatriz(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaObj?.id, policies.length]);

  const salvarPolicy = useMutation({
    mutationFn: async (row: SlaPolicy) => {
      const payload = {
        fila_id: row.fila_id,
        prioridade: row.prioridade,
        primeira_resposta_horas: row.primeira_resposta_horas,
        resolucao_horas: row.resolucao_horas,
        usa_horario_comercial: row.usa_horario_comercial,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("suporte_sla_policies")
        .upsert(payload, { onConflict: "fila_id,prioridade" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-admin", "policies"] });
      toast.success("SLA atualizado");
    },
    onError: (e: Error) => toast.error("Falha ao salvar SLA", { description: e.message }),
  });

  const salvarFilaCalendario = useMutation({
    mutationFn: async (input: { filaId: string; calendarioId: string | null }) => {
      const { error } = await (supabase as any)
        .from("suporte_filas")
        .update({ calendario_id: input.calendarioId })
        .eq("id", input.filaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-admin", "filas"] });
      toast.success("Calendário do departamento atualizado");
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Acesso restrito a administradores.
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/suporte/desk")}
          >
            <ArrowLeft className="h-4 w-4" /> Central de Suporte
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" /> SLA e Calendários
            </h2>
            <p className="text-sm text-muted-foreground">
              Defina o tempo de primeira resposta e de resolução por departamento e
              prioridade, e configure calendários de expediente.
            </p>
          </div>
        </div>

        <Tabs defaultValue="matriz">
          <TabsList>
            <TabsTrigger value="matriz" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Matriz de SLA
            </TabsTrigger>
            <TabsTrigger value="calendarios" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Calendários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matriz" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-base">Departamento</CardTitle>
                  <Select value={filaSel} onValueChange={setFilaSel}>
                    <SelectTrigger className="w-[280px] h-9">
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {filas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filaObj && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Label className="text-xs text-muted-foreground">Calendário do dept.:</Label>
                      <Select
                        value={filaObj.calendario_id ?? "__none__"}
                        onValueChange={(v) =>
                          salvarFilaCalendario.mutate({
                            filaId: filaObj.id,
                            calendarioId: v === "__none__" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[220px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Padrão (24/7)</SelectItem>
                          {calendarios.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome} {c.is_default && "(padrão)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {filasLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filaObj ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Prioridade</TableHead>
                        <TableHead>Primeira resposta (h)</TableHead>
                        <TableHead>Resolução (h)</TableHead>
                        <TableHead>Horário comercial</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PRIORIDADES.map((p) => {
                        const row = matriz[p];
                        return (
                          <TableRow key={p}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {SUPORTE_PRIORIDADE_LABEL[p]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                className="h-8 w-28"
                                value={row.primeira_resposta_horas}
                                onChange={(e) =>
                                  setMatriz((m) => ({
                                    ...m,
                                    [p]: {
                                      ...row,
                                      primeira_resposta_horas: Number(e.target.value),
                                    },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                className="h-8 w-28"
                                value={row.resolucao_horas}
                                onChange={(e) =>
                                  setMatriz((m) => ({
                                    ...m,
                                    [p]: { ...row, resolucao_horas: Number(e.target.value) },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={row.usa_horario_comercial}
                                onCheckedChange={(v) =>
                                  setMatriz((m) => ({
                                    ...m,
                                    [p]: { ...row, usa_horario_comercial: v },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                disabled={salvarPolicy.isPending}
                                onClick={() =>
                                  salvarPolicy.mutate({ ...row, fila_id: filaObj.id })
                                }
                              >
                                <Save className="h-3.5 w-3.5" /> Salvar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum departamento cadastrado.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendarios" className="mt-4">
            <CalendariosEditor calendarios={calendarios} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ---------------- Calendários ----------------

function CalendariosEditor({ calendarios }: { calendarios: Calendario[] }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<string>(calendarios[0]?.id ?? "");

  useEffect(() => {
    if (!sel && calendarios[0]) setSel(calendarios[0].id);
  }, [calendarios, sel]);

  const cal = calendarios.find((c) => c.id === sel);

  const [draft, setDraft] = useState<Calendario | null>(null);
  useEffect(() => {
    if (cal) {
      setDraft({
        ...cal,
        intervalos: normalizarIntervalos(cal.intervalos),
        feriados: cal.feriados ?? [],
      });
    }
  }, [cal?.id]);

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("suporte_calendarios")
        .insert({
          nome: "Novo calendário",
          timezone: "America/Sao_Paulo",
          intervalos: intervalosPadrao(),
          feriados: [],
          is_default: false,
          ativo: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["suporte-admin", "calendarios"] });
      setSel(id);
      toast.success("Calendário criado");
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  const salvar = useMutation({
    mutationFn: async (d: Calendario) => {
      const { error } = await (supabase as any)
        .from("suporte_calendarios")
        .update({
          nome: d.nome,
          timezone: d.timezone,
          intervalos: d.intervalos,
          feriados: d.feriados,
          is_default: d.is_default,
          ativo: d.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-admin", "calendarios"] });
      toast.success("Calendário salvo");
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("suporte_calendarios")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-admin", "calendarios"] });
      setSel("");
      toast.success("Calendário excluído");
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  const [novoFeriado, setNovoFeriado] = useState("");

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Calendários</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              disabled={criar.isPending}
              onClick={() => criar.mutate()}
            >
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {calendarios.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum calendário. Crie um para definir expediente.
            </p>
          ) : (
            <ul className="space-y-1">
              {calendarios.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSel(c.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent ${
                      sel === c.id ? "bg-accent font-medium" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{c.nome}</span>
                      {c.is_default && (
                        <Badge variant="outline" className="text-[9px]">padrão</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{c.timezone}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {draft ? draft.nome : "Selecione um calendário"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!draft ? (
            <p className="text-sm text-muted-foreground">Selecione ou crie um calendário.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={draft.nome}
                    onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Timezone</Label>
                  <Input
                    value={draft.timezone}
                    onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                    className="h-8"
                    placeholder="America/Sao_Paulo"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.is_default}
                    onCheckedChange={(v) => setDraft({ ...draft, is_default: v })}
                  />
                  <Label className="text-xs">Padrão do sistema</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.ativo}
                    onCheckedChange={(v) => setDraft({ ...draft, ativo: v })}
                  />
                  <Label className="text-xs">Ativo</Label>
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Expediente por dia</Label>
                <div className="grid gap-2">
                  {DIAS.map((d) => {
                    const janela = (draft.intervalos as any)[d.key]?.[0] as
                      | [string, string]
                      | undefined;
                    const ativo = !!janela;
                    return (
                      <div key={d.key} className="flex items-center gap-2">
                        <div className="w-14 text-xs font-medium">{d.label}</div>
                        <Switch
                          checked={ativo}
                          onCheckedChange={(v) => {
                            const intervalos = { ...(draft.intervalos as any) };
                            if (v) intervalos[d.key] = [["09:00", "18:00"]];
                            else delete intervalos[d.key];
                            setDraft({ ...draft, intervalos });
                          }}
                        />
                        {ativo ? (
                          <>
                            <Input
                              type="time"
                              value={janela![0]}
                              className="h-8 w-28"
                              onChange={(e) => {
                                const intervalos = { ...(draft.intervalos as any) };
                                intervalos[d.key] = [[e.target.value, janela![1]]];
                                setDraft({ ...draft, intervalos });
                              }}
                            />
                            <span className="text-xs text-muted-foreground">até</span>
                            <Input
                              type="time"
                              value={janela![1]}
                              className="h-8 w-28"
                              onChange={(e) => {
                                const intervalos = { ...(draft.intervalos as any) };
                                intervalos[d.key] = [[janela![0], e.target.value]];
                                setDraft({ ...draft, intervalos });
                              }}
                            />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não atende</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Feriados</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="date"
                    value={novoFeriado}
                    onChange={(e) => setNovoFeriado(e.target.value)}
                    className="h-8 w-44"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={!novoFeriado}
                    onClick={() => {
                      if (!novoFeriado) return;
                      if (draft.feriados.includes(novoFeriado)) return;
                      setDraft({
                        ...draft,
                        feriados: [...draft.feriados, novoFeriado].sort(),
                      });
                      setNovoFeriado("");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.feriados.length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhum feriado.</span>
                  )}
                  {draft.feriados.map((f) => (
                    <Badge key={f} variant="outline" className="gap-1 text-xs">
                      {f}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            feriados: draft.feriados.filter((x) => x !== f),
                          })
                        }
                        className="hover:text-destructive"
                        aria-label="Remover"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={excluir.isPending}
                  onClick={() => {
                    if (confirm(`Excluir calendário "${draft.nome}"?`)) excluir.mutate(draft.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={salvar.isPending}
                  onClick={() => salvar.mutate(draft)}
                >
                  <Save className="h-3.5 w-3.5" /> Salvar calendário
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function intervalosPadrao() {
  return {
    seg: [["09:00", "18:00"]],
    ter: [["09:00", "18:00"]],
    qua: [["09:00", "18:00"]],
    qui: [["09:00", "18:00"]],
    sex: [["09:00", "18:00"]],
  };
}

function normalizarIntervalos(i: any) {
  if (!i || typeof i !== "object") return intervalosPadrao();
  return i;
}
