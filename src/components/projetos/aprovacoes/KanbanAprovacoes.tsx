import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ChevronRight, Workflow, AlertTriangle, Clock, Settings2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useKanbanAprovacoes,
  useMoverItemKanban,
  type EscopoKanban,
  type KanbanItem,
  type KanbanPipeline,
} from "@/hooks/useKanbanAprovacoes";
import { useKanbanPreferencias } from "@/hooks/useKanbanPreferencias";
import { ItemAprovacaoDrawer } from "./ItemAprovacaoDrawer";
import { KanbanConfigSheet } from "./KanbanConfigSheet";

interface Props {
  escopo: EscopoKanban["escopo"];
  projetoId?: string;
  secaoId?: string | null;
  titulo?: string;
  subtitulo?: string;
}

const COLOR_BY_LOTE = [
  "border-l-primary",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-sky-500",
  "border-l-fuchsia-500",
  "border-l-rose-500",
];

function loteColor(loteId: string | null) {
  if (!loteId) return "border-l-muted-foreground/40";
  let h = 0;
  for (let i = 0; i < loteId.length; i++) h = (h * 31 + loteId.charCodeAt(i)) >>> 0;
  return COLOR_BY_LOTE[h % COLOR_BY_LOTE.length];
}

function ItemCard({
  item,
  onOpen,
}: {
  item: KanbanItem;
  onOpen: (i: KanbanItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });
  const atrasado = item.prazo_em && new Date(item.prazo_em) < new Date() && item.status === "em_andamento";

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(item)}
      className={cn(
        "p-2.5 cursor-pointer hover:border-primary/40 transition border-l-2 bg-card/80 backdrop-blur-sm",
        loteColor(item.lote_id),
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-semibold leading-tight line-clamp-2 flex-1 flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
          {item.documento_nome || item.documento_tipo || "Documento"}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>

      {(item.projeto_nome || item.tarefa_titulo) && (
        <p className="text-[10px] text-muted-foreground truncate mb-1">
          {[item.projeto_nome, item.tarefa_titulo].filter(Boolean).join(" › ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {item.lote_nome && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{item.lote_nome}</Badge>
        )}
        {item.etapa_tipo === "encaminhamento" && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5">
            <Workflow className="h-2.5 w-2.5" /> encaminha
          </Badge>
        )}
        {item.responsavel_nome && (
          <span className="text-[10px] text-muted-foreground">→ {item.responsavel_nome}</span>
        )}
      </div>

      {item.status === "em_andamento" && item.prazo_em && (
        <div className="mt-1">
          {atrasado ? (
            <Badge variant="destructive" className="text-[10px] h-4 gap-0.5 px-1.5">
              <AlertTriangle className="h-2.5 w-2.5" /> Vencido
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {new Date(item.prazo_em).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function Column({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[280px] w-[280px] shrink-0 bg-muted/30 rounded-lg p-2 space-y-2 transition",
        isOver && "ring-2 ring-primary bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold">{title}</p>
        <Badge variant="outline" className="text-[10px] h-4">{count}</Badge>
      </div>
      <div className="space-y-2 min-h-[60px]">{children}</div>
    </div>
  );
}

export function KanbanAprovacoes({ escopo, projetoId, secaoId, titulo, subtitulo }: Props) {
  const { user } = useAuth();
  const { prefs } = useKanbanPreferencias();

  const input = useMemo<EscopoKanban>(() => {
    if (escopo === "pessoal") return { escopo: "pessoal", userId: user?.id, modoVisao: prefs.modo_visao };
    if (escopo === "projeto") return { escopo: "projeto", projetoId, secaoId };
    return { escopo: "secao", secaoId: secaoId ?? undefined };
  }, [escopo, user?.id, projetoId, secaoId, prefs.modo_visao]);

  const { data, isLoading } = useKanbanAprovacoes(input);
  const mover = useMoverItemKanban();
  const [drawerItem, setDrawerItem] = useState<KanbanItem | null>(null);
  const [pipelineFiltro, setPipelineFiltro] = useState<string>("all");
  const [configOpen, setConfigOpen] = useState(false);

  const allPipelines: KanbanPipeline[] = data?.pipelines || [];
  const itens: KanbanItem[] = data?.itens || [];

  // Aplica filtro de preferências (pipelines_visiveis)
  const pipelinesPorPref = prefs.pipelines_visiveis.length === 0
    ? allPipelines
    : allPipelines.filter((p) => prefs.pipelines_visiveis.includes(p.id));

  const pipelinesVisiveis = pipelineFiltro === "all"
    ? pipelinesPorPref
    : pipelinesPorPref.filter((p) => p.id === pipelineFiltro);

  // KPIs
  const agora = new Date();
  const kpis = useMemo(() => {
    const ativos = itens.filter((i) => i.status === "em_andamento");
    const atrasados = ativos.filter((i) => i.prazo_em && new Date(i.prazo_em) < agora);
    const hoje = ativos.filter((i) => {
      if (!i.prazo_em) return false;
      const d = new Date(i.prazo_em);
      return d.toDateString() === agora.toDateString();
    });
    const finalizados = itens.filter((i) =>
      ["aprovado", "rejeitado", "encaminhado"].includes(i.status),
    );
    return { pendentes: ativos.length, atrasados: atrasados.length, hoje: hoje.length, finalizados: finalizados.length };
  }, [itens]);

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const item = e.active.data.current?.item as KanbanItem | undefined;
    const destinoEtapaId = String(e.over.id);
    if (!item || item.etapa_atual_id === destinoEtapaId) return;
    if (destinoEtapaId.startsWith("col-")) return;
    mover.mutate({ itemId: item.id, etapaDestinoId: destinoEtapaId });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const modoLabel: Record<string, string> = {
    minhas: "Minhas pendências",
    equipe: "Equipe",
    coordenacao: "Coordenação",
    todas: "Todas",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {titulo && <h1 className="text-xl font-semibold">{titulo}</h1>}
          {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        {escopo === "pessoal" && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Eye className="h-3 w-3" /> {modoLabel[prefs.modo_visao]}
            </Badge>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Configurar
            </Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <p className="text-[10px] text-muted-foreground uppercase">Pendentes</p>
          <p className="text-xl font-semibold">{kpis.pendentes}</p>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <p className="text-[10px] text-muted-foreground uppercase">Atrasadas</p>
          <p className="text-xl font-semibold text-destructive">{kpis.atrasados}</p>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <p className="text-[10px] text-muted-foreground uppercase">Vencem hoje</p>
          <p className="text-xl font-semibold">{kpis.hoje}</p>
        </Card>
        <Card className="p-3 bg-card/70 backdrop-blur-sm">
          <p className="text-[10px] text-muted-foreground uppercase">Finalizadas</p>
          <p className="text-xl font-semibold text-muted-foreground">{kpis.finalizados}</p>
        </Card>
      </div>

      {pipelinesPorPref.length > 1 && (
        <Tabs value={pipelineFiltro} onValueChange={setPipelineFiltro}>
          <TabsList>
            <TabsTrigger value="all">Todos os pipelines</TabsTrigger>
            {pipelinesPorPref.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>{p.nome}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {!isLoading && pipelinesVisiveis.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground bg-card/50">
          Nenhum pipeline de aprovação configurado. Peça a um administrador para criar um em
          <span className="font-mono mx-1">/admin/templates-alcadas</span>.
        </Card>
      )}

      {!isLoading && pipelinesVisiveis.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            {pipelinesVisiveis.map((p) => {
              const itensPipe = itens.filter((i) => i.pipeline_id === p.id);
              const finalizados = itensPipe.filter((i) =>
                ["aprovado", "rejeitado", "encaminhado", "cancelado"].includes(i.status),
              );
              return (
                <div key={p.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">{p.nome}</h3>
                    <Badge variant="secondary" className="text-[10px] h-4">{itensPipe.length}</Badge>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {p.etapas.map((et) => {
                      const itensEt = itensPipe.filter(
                        (i) => i.etapa_atual_id === et.id && i.status === "em_andamento",
                      );
                      return (
                        <Column key={et.id} id={et.id} title={et.nome} count={itensEt.length}>
                          {itensEt.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/60 italic px-1 py-2">
                              Sem itens
                            </p>
                          )}
                          {itensEt.map((it) => (
                            <ItemCard key={it.id} item={it} onOpen={setDrawerItem} />
                          ))}
                        </Column>
                      );
                    })}
                    {prefs.mostrar_finalizados && finalizados.length > 0 && (
                      <Column
                        id="col-finalizados"
                        title="Finalizados"
                        count={finalizados.length}
                      >
                        {finalizados.map((it) => (
                          <ItemCard key={it.id} item={it} onOpen={setDrawerItem} />
                        ))}
                      </Column>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}

      <ItemAprovacaoDrawer
        item={drawerItem}
        open={!!drawerItem}
        onOpenChange={(v) => !v && setDrawerItem(null)}
      />

      <KanbanConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        pipelinesDisponiveis={allPipelines}
        showModoVisao={escopo === "pessoal"}
      />
    </div>
  );
}
