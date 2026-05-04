import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock3,
  Pencil,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useKanbanAprovacoes,
  type EscopoKanban,
  type KanbanItem,
  type KanbanPipeline,
} from "@/hooks/useKanbanAprovacoes";
import {
  useKanbanPreferencias,
  COLUNA_ORDEM,
  getColunaConfig,
  type ColunaKey,
} from "@/hooks/useKanbanPreferencias";
import { KanbanConfigSheet } from "./KanbanConfigSheet";
import { CardAprovacao } from "./kanban/CardAprovacao";
import { JornadaDrawer } from "./kanban/JornadaDrawer";

interface Props {
  escopo: EscopoKanban["escopo"];
  projetoId?: string;
  secaoId?: string | null;
  titulo?: string;
  subtitulo?: string;
}

/**
 * Mapeia o estado interno de um item para uma das colunas universais do Kanban.
 * Permite que pipelines com qualquer número de etapas convivam em 4-5 colunas fixas.
 */
function mapItemToColuna(item: KanbanItem, currentUserId?: string): ColunaKey {
  if (item.status === "aprovado" || item.status === "encaminhado") return "aprovado";
  if (item.status === "rejeitado" || item.status === "cancelado") return "rejeitado";
  // em_andamento
  const minhaVez = item.responsavel_atual_id === currentUserId;
  if (!minhaVez && currentUserId) return "aguardando_outros";
  // 1ª etapa = Em Análise; etapas subsequentes = Em Revisão
  if ((item.etapa_ordem ?? 1) <= 1) return "em_analise";
  return "em_revisao";
}

const COLUNA_ICONS: Record<ColunaKey, React.ComponentType<{ className?: string }>> = {
  em_analise: Clock3,
  em_revisao: Pencil,
  aguardando_outros: Hourglass,
  aprovado: CheckCircle2,
  rejeitado: XCircle,
};

const COLUNA_VARIANT: Record<ColunaKey, string> = {
  em_analise: "bg-sky-500/5 border-sky-500/20",
  em_revisao: "bg-amber-500/5 border-amber-500/20",
  aguardando_outros: "bg-muted/30 border-muted-foreground/20",
  aprovado: "bg-emerald-500/5 border-emerald-500/20",
  rejeitado: "bg-destructive/5 border-destructive/20",
};

const COLUNA_ICON_COLOR: Record<ColunaKey, string> = {
  em_analise: "text-sky-500",
  em_revisao: "text-amber-500",
  aguardando_outros: "text-muted-foreground",
  aprovado: "text-emerald-500",
  rejeitado: "text-destructive",
};

function Coluna({
  colKey,
  title,
  count,
  children,
}: {
  colKey: ColunaKey;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${colKey}` });
  const Icon = COLUNA_ICONS[colKey];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[260px] rounded-lg border p-2 space-y-2 transition",
        COLUNA_VARIANT[colKey],
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn("h-3.5 w-3.5", COLUNA_ICON_COLOR[colKey])} />
          <p className="text-xs font-semibold truncate">{title}</p>
        </div>
        <Badge variant="outline" className="text-[10px] h-4 shrink-0">
          {count}
        </Badge>
      </div>
      <div className="space-y-2 min-h-[80px]">{children}</div>
    </div>
  );
}

export function KanbanAprovacoes({
  escopo,
  projetoId,
  secaoId,
  titulo,
  subtitulo,
}: Props) {
  const { user } = useAuth();
  const { prefs } = useKanbanPreferencias();

  const input = useMemo<EscopoKanban>(() => {
    if (escopo === "pessoal")
      return { escopo: "pessoal", userId: user?.id, modoVisao: prefs.modo_visao };
    if (escopo === "projeto") return { escopo: "projeto", projetoId, secaoId };
    return { escopo: "secao", secaoId: secaoId ?? undefined };
  }, [escopo, user?.id, projetoId, secaoId, prefs.modo_visao]);

  const { data, isLoading } = useKanbanAprovacoes(input);
  const [drawerItem, setDrawerItem] = useState<KanbanItem | null>(null);
  const [pipelineFiltro, setPipelineFiltro] = useState<string>("all");
  const [configOpen, setConfigOpen] = useState(false);

  const allPipelines: KanbanPipeline[] = data?.pipelines || [];
  const itens: KanbanItem[] = data?.itens || [];

  const pipelinesPorPref =
    prefs.pipelines_visiveis.length === 0
      ? allPipelines
      : allPipelines.filter((p) => prefs.pipelines_visiveis.includes(p.id));

  // Filtro por pipeline (chips)
  const itensFiltrados = useMemo(() => {
    let arr = itens;
    if (pipelineFiltro !== "all") {
      arr = arr.filter((i) => i.pipeline_id === pipelineFiltro);
    } else if (prefs.pipelines_visiveis.length > 0) {
      arr = arr.filter((i) => prefs.pipelines_visiveis.includes(i.pipeline_id));
    }
    return arr;
  }, [itens, pipelineFiltro, prefs.pipelines_visiveis]);

  // Pipeline lookup para os cards
  const pipelineMap = useMemo(() => {
    const m = new Map<string, KanbanPipeline>();
    allPipelines.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPipelines]);

  // Distribui itens nas colunas universais
  const itensPorColuna = useMemo(() => {
    const out: Record<ColunaKey, KanbanItem[]> = {
      em_analise: [],
      em_revisao: [],
      aguardando_outros: [],
      aprovado: [],
      rejeitado: [],
    };
    itensFiltrados.forEach((it) => {
      out[mapItemToColuna(it, user?.id)].push(it);
    });
    return out;
  }, [itensFiltrados, user?.id]);

  // KPIs
  const agora = new Date();
  const kpis = useMemo(() => {
    const ativos = itensFiltrados.filter((i) => i.status === "em_andamento");
    const atrasados = ativos.filter(
      (i) => i.prazo_em && new Date(i.prazo_em) < agora,
    );
    const hoje = ativos.filter((i) => {
      if (!i.prazo_em) return false;
      const d = new Date(i.prazo_em);
      return d.toDateString() === agora.toDateString();
    });
    const finalizados = itensFiltrados.filter((i) =>
      ["aprovado", "rejeitado", "encaminhado"].includes(i.status),
    );
    return {
      pendentes: ativos.length,
      atrasados: atrasados.length,
      hoje: hoje.length,
      finalizados: finalizados.length,
    };
  }, [itensFiltrados]);

  const [pendingMove, setPendingMove] = useState<{
    item: KanbanItem;
    destino: "aprovado" | "rejeitado" | "em_revisao";
  } | null>(null);

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("col-")) return;
    const destino = overId.replace("col-", "") as ColunaKey;
    const item = e.active.data.current?.item as KanbanItem | undefined;
    if (!item) return;
    const origem = mapItemToColuna(item, user?.id);
    if (origem === destino) return;
    if (item.status !== "em_andamento") {
      toast.error("Item já finalizado");
      return;
    }
    if (item.responsavel_atual_id !== user?.id) {
      toast.error("Apenas o responsável atual pode mover este card");
      return;
    }
    if (destino === "aprovado" || destino === "rejeitado" || destino === "em_revisao") {
      setPendingMove({ item, destino });
    } else {
      toast.error("Mover para esta coluna não é permitido");
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const modoLabel: Record<string, string> = {
    minhas: "Minhas pendências",
    equipe: "Equipe",
    coordenacao: "Coordenação",
    todas: "Todas",
  };

  const colunasVisiveis = COLUNA_ORDEM.filter((k) => {
    const cfg = getColunaConfig(prefs, k);
    if (!cfg.visivel) return false;
    // Em escopo de projeto/seção, "aguardando_outros" não faz sentido sem currentUserId no filtro
    if (k === "aguardando_outros" && escopo !== "pessoal") return false;
    return true;
  });

  const drawerPipeline = drawerItem ? pipelineMap.get(drawerItem.pipeline_id) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {titulo && <h1 className="text-xl font-semibold">{titulo}</h1>}
          {subtitulo && (
            <p className="text-sm text-muted-foreground">{subtitulo}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {escopo === "pessoal" && (
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Eye className="h-3 w-3" /> {modoLabel[prefs.modo_visao]}
            </Badge>
          )}
          {pipelinesPorPref.length > 1 && (
            <Select value={pipelineFiltro} onValueChange={setPipelineFiltro}>
              <SelectTrigger className="h-8 text-xs w-[200px]">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pipelines</SelectItem>
                {pipelinesPorPref.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Configurar
          </Button>
        </div>
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
          <p className="text-xl font-semibold text-muted-foreground">
            {kpis.finalizados}
          </p>
        </Card>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {!isLoading && allPipelines.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground bg-card/50">
          Nenhum pipeline de aprovação configurado. Peça a um administrador para
          criar um em
          <span className="font-mono mx-1">/admin/templates-alcadas</span>.
        </Card>
      )}

      {!isLoading && allPipelines.length > 0 && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {colunasVisiveis.map((k) => {
              const cfg = getColunaConfig(prefs, k);
              const list = itensPorColuna[k];
              return (
                <Coluna key={k} colKey={k} title={cfg.label} count={list.length}>
                  {list.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/60 italic px-1 py-2">
                      Sem itens
                    </p>
                  ) : (
                    list.map((it) => (
                      <CardAprovacao
                        key={it.id}
                        item={it}
                        pipeline={pipelineMap.get(it.pipeline_id)}
                        onOpen={setDrawerItem}
                      />
                    ))
                  )}
                </Coluna>
              );
            })}
          </div>
        </DndContext>
      )}

      <JornadaDrawer
        item={drawerItem}
        pipeline={drawerPipeline}
        open={!!drawerItem}
        onOpenChange={(v) => !v && setDrawerItem(null)}
      />

      <KanbanConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        pipelinesDisponiveis={allPipelines}
        showModoVisao={escopo === "pessoal"}
      />

      <MoverColunaDialog
        open={!!pendingMove}
        onOpenChange={(v) => !v && setPendingMove(null)}
        item={pendingMove?.item ?? null}
        destino={pendingMove?.destino ?? null}
      />
    </div>
  );
}
