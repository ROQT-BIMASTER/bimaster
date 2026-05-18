import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  ArrowRightCircle,
  ExternalLink,
  FileText,
  Workflow,
  Loader2,
  Circle,
  Clock,
  AlertTriangle,
  GitBranch,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAvancarItem,
  useSolicitarRevisao,
  type KanbanItem,
  type KanbanPipeline,
} from "@/hooks/useKanbanAprovacoes";
import { RotateCcw, ShieldCheck, UserPlus, CalendarClock, History, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DelegarDialog } from "./DelegarDialog";
import { OficializarCofreDialog } from "./OficializarCofreDialog";
import { HistoricoItemDialog } from "./HistoricoItemDialog";
import { useDefinirPrazoItem, useRevogarOficializacao } from "@/hooks/useKanbanAprovacoes";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  item: KanbanItem | null;
  pipeline?: KanbanPipeline;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface HistoricoEntry {
  id: string;
  etapa_id: string | null;
  etapa_nome: string | null;
  decisao: string | null;
  comentario: string | null;
  decidido_por_nome: string | null;
  decidido_em: string | null;
}

export function JornadaDrawer({ item, pipeline, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const avancar = useAvancarItem();
  const solicitarRevisao = useSolicitarRevisao();
  const definirPrazo = useDefinirPrazoItem();
  const [comentario, setComentario] = useState("");
  const [delegarOpen, setDelegarOpen] = useState(false);
  const [oficializarOpen, setOficializarOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [revogarOpen, setRevogarOpen] = useState(false);
  const [revogarMotivo, setRevogarMotivo] = useState("");
  const revogar = useRevogarOficializacao();
  const [novoPrazo, setNovoPrazo] = useState("");

  useEffect(() => {
    if (!open) setComentario("");
  }, [open]);

  // histórico de decisões deste item / lote raiz
  const { data: historico = [] } = useQuery({
    queryKey: ["item-aprovacao-historico", item?.id],
    enabled: !!item?.id && open,
    queryFn: async (): Promise<HistoricoEntry[]> => {
      if (!item) return [];
      const { data, error } = await supabase
        .from("aprovacao_documento_itens")
        .select(
          `id, etapa_atual_id, status, comentario_atual, updated_at, responsavel_atual_id,
           fluxo_aprovacao_etapas!aprovacao_documento_itens_etapa_atual_id_fkey(nome, ordem)`,
        )
        .or(`id.eq.${item.id},parent_item_id.eq.${item.id}`)
        .order("updated_at", { ascending: true });
      if (error) throw error;

      const userIds = Array.from(
        new Set(((data || []) as any[]).map((r) => r.responsavel_atual_id).filter(Boolean)),
      );
      const nomesMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        (profs || []).forEach((p: any) => nomesMap.set(p.id, p.nome));
      }

      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        etapa_id: r.etapa_atual_id,
        etapa_nome: r.fluxo_aprovacao_etapas?.nome ?? null,
        decisao: r.status,
        comentario: r.comentario_atual,
        decidido_por_nome: r.responsavel_atual_id
          ? nomesMap.get(r.responsavel_atual_id) ?? null
          : null,
        decidido_em: r.updated_at,
      }));
    },
  });

  // Auditoria de movimentações entre colunas universais
  const { data: auditoria = [] } = useQuery({
    queryKey: ["item-aprovacao-auditoria", item?.id],
    enabled: !!item?.id && open,
    queryFn: async () => {
      if (!item) return [];
      const { data, error } = await supabase
        .from("aprovacao_kanban_audit" as any)
        .select("id, user_id, coluna_origem, coluna_destino, status_anterior, status_novo, etapa_anterior_nome, etapa_atual_nome, comentario, origem, created_at")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      const rows = (data || []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", ids);
        (profs || []).forEach((p: any) => nomes.set(p.id, p.nome));
      }
      return rows.map((r) => ({ ...r, user_nome: r.user_id ? nomes.get(r.user_id) ?? null : null }));
    },
  });

  if (!item) return null;

  const isResponsavel = item.responsavel_atual_id === user?.id;
  const aberto = item.status === "em_andamento";
  const isEncaminhamento = item.etapa_tipo === "encaminhamento";
  const breadcrumb = [item.projeto_nome, item.secao_nome, item.tarefa_titulo]
    .filter(Boolean)
    .join(" › ");

  const etapas = pipeline?.etapas ?? [];
  const idxAtual = etapas.findIndex((e) => e.id === item.etapa_atual_id);

  async function decidir(decisao: "aprovado" | "rejeitado" | "encaminhado") {
    if (!item) return;
    await avancar.mutateAsync({
      itemId: item.id,
      decisao,
      comentario: comentario || undefined,
    });
    setComentario("");
    onOpenChange(false);
  }

  function statusEtapa(idx: number): "concluida" | "atual" | "pendente" {
    if (item?.status !== "em_andamento") {
      // jornada fechada
      if (item?.status === "aprovado" || item?.status === "encaminhado") return "concluida";
      if (item?.status === "rejeitado") return idx <= idxAtual ? "concluida" : "pendente";
      return "pendente";
    }
    if (idx < idxAtual) return "concluida";
    if (idx === idxAtual) return "atual";
    return "pendente";
  }

  const atrasado =
    item.prazo_em && new Date(item.prazo_em) < new Date() && item.status === "em_andamento";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {item.documento_nome || item.documento_tipo || "Documento"}
          </SheetTitle>
          {breadcrumb && (
            <SheetDescription className="text-xs">{breadcrumb}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status + metadados */}
          <div className="flex flex-wrap gap-1.5">
            {item.pipeline_nome && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Workflow className="h-3 w-3" /> {item.pipeline_nome}
              </Badge>
            )}
            <Badge
              variant={
                item.status === "aprovado"
                  ? "default"
                  : item.status === "rejeitado"
                    ? "destructive"
                    : "outline"
              }
              className="text-[10px] capitalize"
            >
              {item.status.replace("_", " ")}
            </Badge>
            {item.lote_nome && (
              <Badge variant="outline" className="text-[10px]">
                Lote: {item.lote_nome}
              </Badge>
            )}
            {atrasado && (
              <Badge variant="destructive" className="text-[10px] gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" /> Vencido
              </Badge>
            )}
            {item.prazo_em && !atrasado && (
              <Badge variant="outline" className="text-[10px] gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {new Date(item.prazo_em).toLocaleDateString("pt-BR")}
              </Badge>
            )}
          </div>

          {item.responsavel_nome && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" /> Responsável atual:{" "}
              <span className="font-medium text-foreground">{item.responsavel_nome}</span>
            </p>
          )}

          {item.documento_url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => secureDownload(item.documento_url!, undefined, "projeto-anexos")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir documento
            </Button>
          )}

          {/* Jornada vertical */}
          {etapas.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Workflow className="h-3.5 w-3.5 text-primary" /> Jornada de aprovação
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Caminho completo deste documento dentro do pipeline.
                </p>
                <ol className="relative border-l-2 border-border ml-2 space-y-3 pt-1">
                  {etapas.map((et, i) => {
                    const st = statusEtapa(i);
                    const histEtapa = historico.find(
                      (h) => h.etapa_id === et.id && h.decisao !== "em_andamento",
                    );
                    const isFwd =
                      et.tipo === "encaminhamento" || !!et.pipeline_destino_id;
                    return (
                      <li key={et.id} className="ml-4">
                        <span
                          className={cn(
                            "absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 bg-background",
                            st === "concluida" && "border-emerald-500",
                            st === "atual" && "border-primary",
                            st === "pendente" && "border-muted-foreground/30",
                          )}
                        >
                          {st === "concluida" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : st === "atual" ? (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          ) : (
                            <Circle className="h-2 w-2 text-muted-foreground/40" />
                          )}
                        </span>
                        <div
                          className={cn(
                            "rounded-md border p-2",
                            st === "atual" && "border-primary/50 bg-primary/5",
                            st === "concluida" && "border-emerald-500/30 bg-emerald-500/5",
                            st === "pendente" && "border-border bg-muted/20",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {i + 1}
                              </span>
                              <p className="text-xs font-medium truncate">{et.nome}</p>
                              {isFwd && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 gap-0.5"
                                >
                                  <GitBranch className="h-2.5 w-2.5" /> encaminha
                                </Badge>
                              )}
                            </div>
                            {st === "atual" && (
                              <Badge
                                variant="default"
                                className="text-[9px] h-4 px-1.5"
                              >
                                aqui
                              </Badge>
                            )}
                          </div>
                          {histEtapa && (
                            <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                              <p>
                                <span className="capitalize font-medium">
                                  {histEtapa.decisao}
                                </span>
                                {histEtapa.decidido_por_nome &&
                                  ` por ${histEtapa.decidido_por_nome}`}
                                {histEtapa.decidido_em &&
                                  ` em ${new Date(histEtapa.decidido_em).toLocaleString("pt-BR")}`}
                              </p>
                              {histEtapa.comentario && (
                                <p className="italic border-l-2 border-border pl-1.5">
                                  "{histEtapa.comentario}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}

          {/* Auditoria de movimentações */}
          {auditoria.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Auditoria de movimentações
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Registro de cada movimento entre colunas universais.
                </p>
                <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {auditoria.map((a: any) => (
                    <li
                      key={a.id}
                      className="rounded-md border bg-muted/20 p-2 text-[10px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <span className="capitalize">
                            {(a.coluna_origem ?? "—").replace("_", " ")}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="capitalize">
                            {(a.coluna_destino ?? "—").replace("_", " ")}
                          </span>
                        </div>
                        <Badge variant="outline" className="h-4 text-[9px] px-1 capitalize">
                          {a.origem}
                        </Badge>
                      </div>
                      {(a.etapa_anterior_nome || a.etapa_atual_nome) && (
                        <p className="text-muted-foreground">
                          Etapa: {a.etapa_anterior_nome ?? "—"} → {a.etapa_atual_nome ?? "—"}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {a.user_nome ?? "Sistema"} ·{" "}
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </p>
                      {a.comentario && (
                        <p className="italic border-l-2 border-border pl-1.5">
                          "{a.comentario}"
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Ações */}
          {aberto && isResponsavel && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold">Sua decisão</p>
                <Textarea
                  placeholder="Comentário (opcional)"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className="text-xs min-h-[64px]"
                />
                <div className="grid grid-cols-1 gap-2">
                  {isEncaminhamento ? (
                    <Button
                      onClick={() => decidir("encaminhado")}
                      disabled={avancar.isPending}
                      size="sm"
                    >
                      {avancar.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <ArrowRightCircle className="h-3.5 w-3.5 mr-2" />
                      )}
                      Encaminhar para próximo pipeline
                    </Button>
                  ) : (
                    <Button
                      onClick={() => decidir("aprovado")}
                      disabled={avancar.isPending}
                      size="sm"
                    >
                      {avancar.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                      )}
                      Aprovar e avançar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!item) return;
                      await solicitarRevisao.mutateAsync({
                        itemId: item.id,
                        comentario: comentario || undefined,
                      });
                      setComentario("");
                      onOpenChange(false);
                    }}
                    disabled={solicitarRevisao.isPending}
                    size="sm"
                  >
                    {solicitarRevisao.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    )}
                    Solicitar revisão (devolver ao autor)
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => decidir("rejeitado")}
                    disabled={avancar.isPending}
                    size="sm"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-2" /> Rejeitar
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Ações auxiliares: delegar / oficializar / prazo */}
          {aberto && isResponsavel && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setDelegarOpen(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Delegar
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Prazo
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-2">
                  <p className="text-xs font-medium">Definir prazo</p>
                  <Input
                    type="datetime-local"
                    value={novoPrazo}
                    onChange={(e) => setNovoPrazo(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!novoPrazo || definirPrazo.isPending}
                    onClick={async () => {
                      await definirPrazo.mutateAsync({
                        itemId: item!.id,
                        prazo: new Date(novoPrazo).toISOString(),
                      });
                      setNovoPrazo("");
                    }}
                  >
                    Salvar
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {item.status === "aprovado" && !item.oficializado_em && (
            <Button size="sm" className="w-full" onClick={() => setOficializarOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Tornar oficial no Cofre
            </Button>
          )}
          {item.oficializado_em && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-emerald-500 flex items-center gap-1 border border-emerald-500/30 rounded p-1.5">
                <ShieldCheck className="h-3 w-3" /> Oficializado no Cofre
                {item.oficializado_destino === "generico" ? " Genérico" : " do Produto"}
              </p>
              {item.oficializado_destino === "generico" && (
                <Popover open={revogarOpen} onOpenChange={setRevogarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-amber-600">
                      <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Revogar oficialização
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 space-y-2">
                    <p className="text-xs font-medium">Revogar oficialização?</p>
                    <p className="text-[10px] text-muted-foreground">
                      O documento será marcado como revogado no Cofre Genérico e a
                      ação ficará registrada no histórico.
                    </p>
                    <Textarea
                      placeholder="Motivo (opcional)"
                      value={revogarMotivo}
                      onChange={(e) => setRevogarMotivo(e.target.value)}
                      className="text-xs min-h-[60px]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRevogarOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revogar.isPending}
                        onClick={async () => {
                          await revogar.mutateAsync({
                            itemId: item.id,
                            motivo: revogarMotivo.trim() || undefined,
                          });
                          setRevogarMotivo("");
                          setRevogarOpen(false);
                        }}
                      >
                        {revogar.isPending && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        Revogar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setHistoricoOpen(true)}
          >
            <History className="h-3.5 w-3.5 mr-1.5" /> Ver histórico do item
          </Button>

          {aberto && !isResponsavel && (
            <p className="text-xs text-muted-foreground border border-dashed rounded p-2">
              Apenas o responsável atual pode decidir esta etapa. Você pode acompanhar
              a evolução pela jornada acima.
            </p>
          )}

          {item.tarefa_id && item.projeto_id && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(
                  `/dashboard/projetos/${item.projeto_id}?tarefa=${item.tarefa_id}`,
                );
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir tarefa no projeto
            </Button>
          )}
        </div>
      </SheetContent>
      <DelegarDialog open={delegarOpen} onOpenChange={setDelegarOpen} item={item} />
      <OficializarCofreDialog open={oficializarOpen} onOpenChange={setOficializarOpen} item={item} />
      <HistoricoItemDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        itemId={item.id}
        itemTitulo={item.documento_nome || item.documento_tipo || undefined}
      />
    </Sheet>
  );
}
