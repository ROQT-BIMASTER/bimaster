import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CalendarX, UserX, Clock, FolderKanban,
  MessageSquare, ShieldCheck, RefreshCw, ChevronRight, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Kpis = {
  projetos_total: number;
  projetos_sem_data_fim: number;
  projetos_parados_14d: number;
  tarefas_total: number;
  tarefas_ativas: number;
  tarefas_ativas_sem_prazo: number;
  tarefas_ativas_sem_responsavel: number;
  tarefas_ativas_sem_responsavel_com_criador: number;
  tarefas_atrasadas: number;
  tarefas_proximas_48h: number;
  comentarios_total: number;
  auditoria_eventos_30d: number;
  gerado_em: string;
};

type SemPrazoRow = {
  id: string; projeto_id: string; projeto_nome: string;
  titulo: string; status: string; criador_id: string | null;
  responsavel_id: string | null; created_at: string;
};

type SemRespRow = {
  id: string; projeto_id: string; projeto_nome: string;
  titulo: string; status: string; criador_id: string | null;
  criador_nome: string | null; data_prazo: string | null; created_at: string;
};

export default function ProjetosSaude() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();
  const [tab, setTab] = useState("visao");

  const kpis = useQuery({
    queryKey: ["projetos-health-kpis"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("projetos_health_kpis");
      if (error) throw error;
      return data as Kpis;
    },
  });

  const semPrazo = useQuery({
    queryKey: ["projetos-tarefas-sem-prazo"],
    enabled: isAdmin && tab === "sem_prazo",
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("projetos_tarefas_sem_prazo", { p_limit: 100 });
      if (error) throw error;
      return (data || []) as SemPrazoRow[];
    },
  });

  const semResp = useQuery({
    queryKey: ["projetos-tarefas-sem-responsavel"],
    enabled: isAdmin && tab === "sem_responsavel",
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("projetos_tarefas_sem_responsavel", { p_limit: 100 });
      if (error) throw error;
      return (data || []) as SemRespRow[];
    },
  });

  const dryRun = useQuery({
    queryKey: ["projetos-atribuir-criador-dryrun"],
    enabled: isAdmin && tab === "sem_responsavel",
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("projetos_atribuir_criador_como_responsavel", {
        p_apply: false, p_projeto_id: null,
      });
      if (error) throw error;
      return data as { aplicado: boolean; tarefas_afetadas: number };
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("projetos_atribuir_criador_como_responsavel", {
        p_apply: true, p_projeto_id: null,
      });
      if (error) throw error;
      return data as { aplicado: boolean; tarefas_afetadas: number };
    },
    onSuccess: (res) => {
      toast.success(`${res.tarefas_afetadas} tarefa(s) atualizada(s)`);
      qc.invalidateQueries({ queryKey: ["projetos-health-kpis"] });
      qc.invalidateQueries({ queryKey: ["projetos-tarefas-sem-responsavel"] });
      qc.invalidateQueries({ queryKey: ["projetos-atribuir-criador-dryrun"] });
    },
    onError: (err: any) => toast.error("Falha: " + (err?.message || "erro desconhecido")),
  });

  if (roleLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Acesso restrito
            </CardTitle>
            <CardDescription>Esta área é exclusiva para administradores.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const k = kpis.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Saúde do módulo de Projetos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Indicadores de qualidade dos dados e ações rápidas para preparar o módulo para uso em produção.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["projetos-health-kpis"] });
            qc.invalidateQueries({ queryKey: ["projetos-tarefas-sem-prazo"] });
            qc.invalidateQueries({ queryKey: ["projetos-tarefas-sem-responsavel"] });
            qc.invalidateQueries({ queryKey: ["projetos-atribuir-criador-dryrun"] });
          }}
          disabled={kpis.isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${kpis.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Projetos ativos"
          value={k?.projetos_total}
          hint={`${k?.projetos_sem_data_fim ?? "—"} sem data-alvo`}
          icon={<FolderKanban className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Projetos parados (14d)"
          value={k?.projetos_parados_14d}
          hint="sem nenhum evento"
          tone={k && k.projetos_parados_14d > 0 ? "warn" : "ok"}
          icon={<Clock className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Tarefas ativas"
          value={k?.tarefas_ativas}
          hint={`${k?.tarefas_total ?? "—"} no total`}
          icon={<Activity className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Tarefas atrasadas"
          value={k?.tarefas_atrasadas}
          hint={`${k?.tarefas_proximas_48h ?? "—"} vencem em 48h`}
          tone={k && k.tarefas_atrasadas > 0 ? "danger" : "ok"}
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Sem prazo (ativas)"
          value={k?.tarefas_ativas_sem_prazo}
          hint="bloqueia alertas e SLA"
          tone={k && k.tarefas_ativas_sem_prazo > 0 ? "warn" : "ok"}
          icon={<CalendarX className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Sem responsável"
          value={k?.tarefas_ativas_sem_responsavel}
          hint={`${k?.tarefas_ativas_sem_responsavel_com_criador ?? 0} com criador`}
          tone={k && k.tarefas_ativas_sem_responsavel > 0 ? "warn" : "ok"}
          icon={<UserX className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Comentários"
          value={k?.comentarios_total}
          hint="total no módulo"
          icon={<MessageSquare className="h-4 w-4" />}
          loading={kpis.isLoading}
        />
        <KpiCard
          label="Auditoria 30d"
          value={k?.auditoria_eventos_30d}
          hint="eventos registrados"
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="ok"
          loading={kpis.isLoading}
        />
      </div>

      {/* Tabs com ações */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="sem_prazo">
            Sem prazo
            {k && k.tarefas_ativas_sem_prazo > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{k.tarefas_ativas_sem_prazo}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sem_responsavel">
            Sem responsável
            {k && k.tarefas_ativas_sem_responsavel > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{k.tarefas_ativas_sem_responsavel}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo executivo</CardTitle>
              <CardDescription>
                Snapshot gerado em{" "}
                {k ? format(new Date(k.gerado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <BulletStatus
                ok={!!k && k.tarefas_ativas_sem_responsavel === 0}
                label="Toda tarefa ativa tem responsável"
                detail={k ? `${k.tarefas_ativas_sem_responsavel} pendente(s)` : ""}
              />
              <BulletStatus
                ok={!!k && k.tarefas_ativas_sem_prazo === 0}
                label="Toda tarefa ativa tem prazo definido"
                detail={k ? `${k.tarefas_ativas_sem_prazo} sem prazo` : ""}
              />
              <BulletStatus
                ok={!!k && k.tarefas_atrasadas === 0}
                label="Nenhuma tarefa em atraso"
                detail={k ? `${k.tarefas_atrasadas} atrasada(s)` : ""}
              />
              <BulletStatus
                ok={!!k && k.projetos_parados_14d === 0}
                label="Todos os projetos com movimentação recente"
                detail={k ? `${k.projetos_parados_14d} parado(s) há mais de 14 dias` : ""}
              />
              <BulletStatus
                ok={!!k && k.projetos_sem_data_fim === 0}
                label="Todo projeto com data-alvo"
                detail={k ? `${k.projetos_sem_data_fim} sem data-alvo` : ""}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sem_prazo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tarefas ativas sem prazo</CardTitle>
              <CardDescription>
                Defina o prazo abrindo a tarefa. Tarefas sem prazo não disparam alertas de risco nem entram nas projeções.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TarefasTable
                rows={(semPrazo.data || []).map((r) => ({
                  id: r.id, projeto_id: r.projeto_id, projeto_nome: r.projeto_nome,
                  titulo: r.titulo, status: r.status, extra: format(new Date(r.created_at), "dd/MM/yyyy"),
                  extraLabel: "Criada em",
                }))}
                loading={semPrazo.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sem_responsavel" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Atribuição automática de criador
              </CardTitle>
              <CardDescription>
                Atribui o criador como responsável em tarefas ativas sem responsável. A regra só se aplica quando o criador
                ainda é membro do projeto. Recomendado antes de iniciar com a equipe.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm">
                  Tarefas elegíveis:{" "}
                  <span className="font-semibold">{dryRun.data?.tarefas_afetadas ?? "…"}</span>
                </p>
                <p className="text-xs text-muted-foreground">Pré-cálculo (modo simulação)</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!dryRun.data || dryRun.data.tarefas_afetadas === 0 || apply.isPending}
                  >
                    {apply.isPending ? "Aplicando..." : "Aplicar atribuição"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar atribuição em lote</AlertDialogTitle>
                    <AlertDialogDescription>
                      {dryRun.data?.tarefas_afetadas ?? 0} tarefa(s) terão o criador definido como responsável.
                      A ação será registrada na auditoria de cada tarefa. Deseja continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => apply.mutate()}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tarefas ativas sem responsável</CardTitle>
              <CardDescription>
                Atribua manualmente abrindo a tarefa, ou use a atribuição em lote acima.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TarefasTable
                rows={(semResp.data || []).map((r) => ({
                  id: r.id, projeto_id: r.projeto_id, projeto_nome: r.projeto_nome,
                  titulo: r.titulo, status: r.status,
                  extra: r.criador_nome || "—",
                  extraLabel: "Criador",
                }))}
                loading={semResp.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  label, value, hint, icon, tone = "default", loading,
}: {
  label: string;
  value?: number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
  loading?: boolean;
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-500" :
    tone === "warn" ? "text-amber-500" :
    tone === "danger" ? "text-destructive" : "text-foreground";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span className="flex items-center gap-1.5">{icon}{label}</span>
        </div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>
          {loading ? <Skeleton className="h-7 w-16" /> : (value?.toLocaleString("pt-BR") ?? "—")}
        </div>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function BulletStatus({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-foreground"}>{label}</span>
      {detail && <span className="text-muted-foreground text-xs">— {detail}</span>}
    </div>
  );
}

type TableRow = {
  id: string; projeto_id: string; projeto_nome: string;
  titulo: string; status: string; extra: string; extraLabel: string;
};

function TarefasTable({ rows, loading }: { rows: TableRow[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center gap-2">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        Nenhuma pendência encontrada.
      </div>
    );
  }
  return (
    <ScrollArea className="max-h-[480px]">
      <div className="divide-y">
        {rows.map((r) => (
          <Link
            key={r.id}
            to={`/dashboard/projetos/${r.projeto_id}`}
            className="flex items-center gap-3 px-2 py-2.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{r.titulo}</span>
                <Badge variant="outline" className="text-[10px] h-5">{r.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {r.projeto_nome} · {r.extraLabel}: {r.extra}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Link>
        ))}
      </div>
    </ScrollArea>
  );
}
