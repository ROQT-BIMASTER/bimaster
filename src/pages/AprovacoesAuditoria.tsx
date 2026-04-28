import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ArrowLeft, Search, ShieldCheck, History, Filter, RefreshCw, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAprovacoesAuditLogs, type AprovacaoAuditLog } from "@/hooks/useAprovacoesAuditLogs";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  scope_changed:   { label: "Mudança de visão",      tone: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  approved:        { label: "Aprovado",              tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  rejected:        { label: "Rejeitado",             tone: "bg-red-500/10 text-red-700 border-red-500/30" },
  delegated:       { label: "Delegado",              tone: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
  status_changed:  { label: "Status alterado",       tone: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  created:         { label: "Criado",                tone: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
};

function actionMeta(action: string) {
  return ACTION_LABELS[action] ?? {
    label: action.replace(/_/g, " "),
    tone: "bg-muted text-muted-foreground border-border",
  };
}

function describeChange(log: AprovacaoAuditLog): string {
  if (log.entity_type === "inbox_scope") {
    const from = log.old_data?.scope ?? "?";
    const to = log.new_data?.scope ?? "?";
    const surface = log.metadata?.surface ?? "—";
    return `Visão da Caixa de Entrada: ${from} → ${to} (${surface})`;
  }
  if (log.action === "approved") return "Item aprovado na Central de Aprovações";
  if (log.action === "rejected") return "Item rejeitado na Central de Aprovações";
  if (log.entity_type?.startsWith("fluxo_aprovacao")) return `Fluxo de aprovação · ${log.action}`;
  return `${log.entity_type} · ${log.action}`;
}

export default function AprovacoesAuditoria() {
  const [actionFilter, setActionFilter] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AprovacaoAuditLog | null>(null);
  const { bgColor, setBgColor } = usePageBgColor("projetos_aprovacoes_auditoria");

  const { data: logs = [], isLoading, refetch, isFetching, error } = useAprovacoesAuditLogs({
    limit: 200,
    action: actionFilter === "todas" ? null : actionFilter,
  });

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) =>
      (l.user_nome ?? "").toLowerCase().includes(q) ||
      (l.user_email ?? "").toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const acoesDisponiveis = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs],
  );

  return (
    <DashboardLayout>
      <div
        className="space-y-5 p-4 md:p-6 max-w-[1400px] mx-auto"
        style={
          bgColor
            ? ({
                backgroundColor: bgColor,
                minHeight: "100vh",
                color: "hsl(var(--foreground))",
                ...getBgPaletteVars(bgColor),
              } as React.CSSProperties)
            : undefined
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/central/aprovacoes">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Central de Aprovações
              </Link>
            </Button>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <History className="h-4.5 w-4.5" />
              </div>
              <div>
                <h1 className="font-display font-semibold text-lg leading-tight">Auditoria de Aprovações</h1>
                <p className="text-xs text-muted-foreground">
                  Quem fez o quê e quando — incluindo mudanças de visão da Caixa de Entrada
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por usuário, ação ou entidade…"
                className="h-9 pl-8 text-sm"
                maxLength={120}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9 w-[200px] text-sm">
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as ações</SelectItem>
                  {acoesDisponiveis.map((a) => (
                    <SelectItem key={a} value={a}>{actionMeta(a).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary" className="ml-auto text-xs">
              {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}
            </Badge>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Trilha de auditoria
            </CardTitle>
            <CardDescription className="text-xs">
              Mostra os 200 eventos mais recentes do módulo de Aprovações de Projetos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="p-6 text-sm text-destructive">
                Erro ao carregar logs: {(error as Error).message}
              </div>
            ) : isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={History}
                title="Nenhum evento de auditoria"
                description="Ainda não há registros para o filtro selecionado."
                className="py-12"
              />
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Quando</TableHead>
                      <TableHead className="w-[200px]">Quem</TableHead>
                      <TableHead className="w-[160px]">Ação</TableHead>
                      <TableHead>O que mudou</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((log) => {
                      const meta = actionMeta(log.action);
                      return (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(log)}
                        >
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium truncate">{log.user_nome ?? "—"}</div>
                            {log.user_email && (
                              <div className="text-[11px] text-muted-foreground truncate">{log.user_email}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="truncate">{describeChange(log)}</div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">
                              {log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drawer de detalhe */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhe do evento</SheetTitle>
                <SheetDescription className="text-xs">
                  {format(new Date(selected.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <Field label="Usuário" value={selected.user_nome ?? "—"} hint={selected.user_email ?? undefined} />
                <Field label="Ação" value={actionMeta(selected.action).label} hint={selected.action} />
                <Field label="Entidade" value={selected.entity_type} hint={selected.entity_id ?? undefined} />
                <Field label="Resumo" value={describeChange(selected)} />
                {selected.old_data && Object.keys(selected.old_data).length > 0 && (
                  <JsonField label="Antes" value={selected.old_data} />
                )}
                {selected.new_data && Object.keys(selected.new_data).length > 0 && (
                  <JsonField label="Depois" value={selected.new_data} />
                )}
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <JsonField label="Contexto" value={selected.metadata} />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-medium">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground font-mono break-all">{hint}</div>}
    </div>
  );
}

function JsonField({ label, value }: { label: string; value: Record<string, any> }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
      <pre className="text-[11px] bg-muted/40 border rounded p-2 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
