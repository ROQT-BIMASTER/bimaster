import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  FileCheck2,
  FolderOpen,
  ListChecks,
  Clock,
  User,
  FileWarning,
  History,
  Link2,
  Link2Off,
  Pencil,
  Filter,
  BellRing,
  AlertOctagon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter, filterByDateRange } from "@/components/shared/DateRangeFilter";
import {
  useEvidenciasDaEtapa,
  useAuditEvidenciasDaEtapa,
  useReenviarAlertasEspelhosPendentes,
} from "@/hooks/useProcessoTarefaEspelho";
import { EspelhoTimelineDialog } from "@/components/processos/EspelhoTimelineDialog";

interface Props {
  etapaId: string;
}

type StatusFiltro = "todos" | "pendentes" | "concluidas";

/**
 * Painel exibido na aba "Evidências" do Perfil do Processo.
 * - Lista tarefas-espelho desta etapa com filtros (status, período, documento).
 * - Sub-aba "Histórico" mostra log de auditoria (vinculado/alterado/removido).
 */
export function EvidenciasEtapaPanel({ etapaId }: Props) {
  const { data: evidencias = [], isLoading } = useEvidenciasDaEtapa(etapaId);
  const { data: audit = [], isLoading: loadingAudit } = useAuditEvidenciasDaEtapa(etapaId);

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [docFiltro, setDocFiltro] = useState<string>("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [timeline, setTimeline] = useState<{
    espelhoId: string;
    projeto?: string | null;
    tarefa?: string | null;
  } | null>(null);

  const reenviarAlertas = useReenviarAlertasEspelhosPendentes();

  const pendentesSemDoc = useMemo(
    () =>
      evidencias.filter(
        (e) => e.status !== "concluida" && e.exige_documentos && !e.evidencia_documento_id,
      ),
    [evidencias],
  );

  const documentosOpcoes = useMemo(() => {
    const map = new Map<string, string>();
    evidencias.forEach((e) => {
      if (e.evidencia_documento_id && e.evidencia_documento_label) {
        map.set(e.evidencia_documento_id, e.evidencia_documento_label);
      }
    });
    return Array.from(map.entries());
  }, [evidencias]);

  const filtradas = useMemo(() => {
    let list = evidencias;
    if (statusFiltro === "pendentes") list = list.filter((e) => e.status !== "concluida");
    if (statusFiltro === "concluidas") list = list.filter((e) => e.status === "concluida");
    if (docFiltro !== "todos") list = list.filter((e) => e.evidencia_documento_id === docFiltro);
    list = filterByDateRange(list, "concluida_em", dateFrom, dateTo);
    return list;
  }, [evidencias, statusFiltro, docFiltro, dateFrom, dateTo]);

  const concluidas = evidencias.filter((e) => e.status === "concluida");
  const pendentes = evidencias.filter((e) => e.status !== "concluida");

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="lista" className="space-y-3">
      <TabsList className="h-8">
        <TabsTrigger value="lista" className="text-xs gap-1">
          <ListChecks className="h-3 w-3" /> Tarefas espelhadas
        </TabsTrigger>
        <TabsTrigger value="audit" className="text-xs gap-1">
          <History className="h-3 w-3" /> Histórico
        </TabsTrigger>
      </TabsList>

      {/* ── Lista ── */}
      <TabsContent value="lista" className="space-y-3 mt-2">
        {/* Resumo + ação em lote */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant="success" className="gap-1">
            <FileCheck2 className="h-3 w-3" />
            {concluidas.length} concluída{concluidas.length === 1 ? "" : "s"}
          </Badge>
          {pendentes.length > 0 && (
            <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
              <Clock className="h-3 w-3" />
              {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
            </Badge>
          )}
          {pendentesSemDoc.length > 0 && (
            <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive">
              <AlertOctagon className="h-3 w-3" />
              {pendentesSemDoc.length} sem documento
            </Badge>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              disabled={pendentesSemDoc.length === 0 || reenviarAlertas.isPending}
              onClick={() => reenviarAlertas.mutate(etapaId)}
            >
              {reenviarAlertas.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
              Marcar como “Ação solicitada” e reenviar
              {pendentesSemDoc.length > 0 && ` (${pendentesSemDoc.length})`}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap rounded-md border p-2 bg-muted/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </div>
          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendentes">Apenas pendentes</SelectItem>
              <SelectItem value="concluidas">Apenas concluídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={docFiltro} onValueChange={setDocFiltro}>
            <SelectTrigger className="h-9 text-xs w-[200px]">
              <SelectValue placeholder="Documento oficial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os documentos</SelectItem>
              {documentosOpcoes.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
        </div>

        {/* Resultado */}
        {evidencias.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5 inline mr-1" />
            Nenhuma tarefa-espelho registrada nesta etapa ainda.
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            Nenhuma tarefa corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map((ev) => (
              <Card key={ev.espelho_id} className="border-l-4 border-l-primary/40">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{ev.projeto_nome ?? "Projeto"}</span>
                        <span className="text-muted-foreground">›</span>
                        <span className="truncate">{ev.tarefa_titulo ?? "(tarefa removida)"}</span>
                      </div>
                      {ev.entidade_tipo && (
                        <p className="text-[11px] text-muted-foreground">
                          Instância: {ev.entidade_tipo}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={ev.status === "concluida" ? "success" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {ev.status}
                    </Badge>
                  </div>

                  {ev.evidencia_documento_id ? (
                    <div className="rounded-md bg-muted/30 p-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <FileCheck2 className="h-3 w-3 text-success" />
                        <span className="font-medium">Evidência:</span>
                        <span>{ev.evidencia_documento_label}</span>
                      </div>
                      {ev.evidencia_observacao && (
                        <p className="text-[11px] text-muted-foreground italic">
                          "{ev.evidencia_observacao}"
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                        {ev.concluida_por_nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {ev.concluida_por_nome}
                          </span>
                        )}
                        {ev.concluida_em && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(ev.concluida_em).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-warning">
                      <FileWarning className="h-3 w-3" />
                      Aguardando conclusão no módulo Projetos com seleção de documento oficial.
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setTimeline({
                          espelhoId: ev.espelho_id,
                          projeto: ev.projeto_nome,
                          tarefa: ev.tarefa_titulo,
                        })
                      }
                    >
                      <History className="h-3 w-3" />
                      Ver linha do tempo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Auditoria ── */}
      <TabsContent value="audit" className="space-y-2 mt-2">
        {loadingAudit ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : audit.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5 inline mr-1" />
            Nenhuma alteração de documento oficial registrada nesta etapa ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {audit.map((a) => {
              const Icon =
                a.acao === "vinculado" ? Link2 : a.acao === "removido" ? Link2Off : Pencil;
              const cor =
                a.acao === "vinculado"
                  ? "text-success"
                  : a.acao === "removido"
                  ? "text-destructive"
                  : "text-warning";
              return (
                <Card key={a.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Icon className={`h-3.5 w-3.5 ${cor}`} />
                        <span className="capitalize">{a.acao}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="truncate">
                          {a.projeto_nome ?? "Projeto"} › {a.tarefa_titulo ?? "(tarefa removida)"}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground pl-5 space-y-0.5">
                      {a.acao === "vinculado" && a.documento_novo_label && (
                        <p>
                          Documento vinculado:{" "}
                          <span className="font-medium text-foreground">{a.documento_novo_label}</span>
                        </p>
                      )}
                      {a.acao === "removido" && a.documento_anterior_label && (
                        <p>
                          Documento removido:{" "}
                          <span className="font-medium text-foreground">{a.documento_anterior_label}</span>
                        </p>
                      )}
                      {a.acao === "alterado" && (
                        <p>
                          De{" "}
                          <span className="font-medium text-foreground">
                            {a.documento_anterior_label ?? "—"}
                          </span>{" "}
                          → para{" "}
                          <span className="font-medium text-foreground">
                            {a.documento_novo_label ?? "—"}
                          </span>
                        </p>
                      )}
                      {a.alterado_por_nome && (
                        <p className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {a.alterado_por_nome}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
