import { useMemo, useCallback, useEffect, useState } from "react";
import { EtapaAdminDialog } from "./EtapaAdminDialog";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProcesso } from "@/hooks/suporte/useProcessos";
import {
  useRotinasBasicasByIds,
  useSalvarPosicaoEtapa,
  useCriarLigacao,
  useDeletarLigacao,
} from "@/hooks/suporte/useProcessoCanvas";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { Card } from "@/components/ui/card";

// dimensões da swimlane
const LANE_HEIGHT = 180;
const LANE_HEADER_WIDTH = 200;
const LANE_WIDTH = 4000;
const NODE_MIN_X = LANE_HEADER_WIDTH + 24;

interface Props {
  processoId: string;
}

export function ProcessoCanvas({ processoId }: Props) {
  const { data, isLoading } = useProcesso(processoId);
  const { data: filas = [] } = useSuporteFilas();

  const rotinaIds = useMemo(
    () => (data?.etapas ?? []).map((e) => e.rotina_fixa_id),
    [data?.etapas],
  );
  const { data: rotinas = [] } = useRotinasBasicasByIds(rotinaIds);

  const salvarPos = useSalvarPosicaoEtapa();
  const criarLig = useCriarLigacao();
  const removerLig = useDeletarLigacao();

  /** filas envolvidas (deduplicadas, ordenadas por `ordem`) — cada uma vira um swimlane. */
  const lanes = useMemo(() => {
    const usadas = new Set<string>();
    for (const r of rotinas) usadas.add(r.fila_id);
    // sempre inclui a fila dona
    if (data?.processo?.fila_dona_id) usadas.add(data.processo.fila_dona_id);
    return filas
      .filter((f) => usadas.has(f.id))
      .map((f, idx) => ({ ...f, laneY: idx * LANE_HEIGHT }));
  }, [filas, rotinas, data?.processo?.fila_dona_id]);

  const laneById = useMemo(() => {
    const m = new Map<string, (typeof lanes)[number]>();
    for (const l of lanes) m.set(l.id, l);
    return m;
  }, [lanes]);

  const rotinaById = useMemo(() => {
    const m = new Map<string, (typeof rotinas)[number]>();
    for (const r of rotinas) m.set(r.id, r);
    return m;
  }, [rotinas]);

  /** Nodes: 1 grupo por fila + 1 nó por etapa (posicionado dentro do grupo). */
  const initialNodes = useMemo<Node[]>(() => {
    const laneNodes: Node[] = lanes.map((l) => ({
      id: `lane-${l.id}`,
      type: "group",
      position: { x: 0, y: l.laneY },
      style: {
        width: LANE_WIDTH,
        height: LANE_HEIGHT,
        backgroundColor: (l.cor ?? "#94a3b8") + "10",
        border: `1px dashed ${l.cor ?? "#94a3b8"}55`,
        borderRadius: 12,
        pointerEvents: "none",
      },
      data: { label: l.nome },
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -1,
    }));

    const laneHeaders: Node[] = lanes.map((l) => ({
      id: `lane-header-${l.id}`,
      position: { x: 8, y: l.laneY + 8 },
      data: { label: l.nome },
      draggable: false,
      selectable: false,
      focusable: false,
      style: {
        width: LANE_HEADER_WIDTH - 16,
        height: LANE_HEIGHT - 16,
        backgroundColor: (l.cor ?? "#94a3b8") + "22",
        border: `1px solid ${l.cor ?? "#94a3b8"}66`,
        borderRadius: 8,
        color: "hsl(var(--foreground))",
        fontWeight: 600,
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        textAlign: "center",
      },
    }));

    const NODE_WIDTH = 220;
    const NODE_STEP_X = NODE_WIDTH + 120; // 340px
    const SAFE_X = NODE_MIN_X + 20;

    const etapasSorted = [...(data?.etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
    const etapaNodes: Node[] = etapasSorted.map((e, idx) => {
      const r = rotinaById.get(e.rotina_fixa_id);
      const lane = r ? laneById.get(r.fila_id) : null;
      const laneY = lane?.laneY ?? 0;
      const label = e.nome_override ?? r?.titulo ?? "Etapa";
      // Se posicao_x estiver ausente ou dentro/próximo do header (< SAFE_X), auto-espaça por ordem.
      const rawX = e.posicao_x || 0;
      const px = rawX >= SAFE_X ? rawX : SAFE_X + idx * NODE_STEP_X;
      // posicao_y funciona como offset dentro da lane (evita sobreposição vertical entre etapas na mesma fila).
      const rawY = e.posicao_y || 0;
      const py = laneY + 40 + (rawY > 0 && rawY < LANE_HEIGHT - 60 ? rawY % 60 : 0);
      return {
        id: e.id,
        position: { x: px, y: py },
        data: {
          label: (
            <div className="text-xs text-left leading-tight">
              <div className="font-semibold">{label}</div>
              {e.sla_minutos ? (
                <div className="text-[10px] text-muted-foreground mt-1">SLA {e.sla_minutos}min</div>
              ) : null}
            </div>
          ),
        },
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: `2px solid ${lane?.cor ?? "hsl(var(--border))"}`,
          borderRadius: 8,
          width: NODE_WIDTH,
          padding: 10,
        },
      };
    });

    return [...laneNodes, ...laneHeaders, ...etapaNodes];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, data?.etapas, rotinaById, laneById]);

  const initialEdges = useMemo<Edge[]>(
    () =>
      (data?.ligacoes ?? []).map((l) => ({
        id: l.id,
        source: l.de_etapa_id,
        target: l.para_etapa_id,
        label: l.sla_handoff_minutos ? `handoff ${l.sla_handoff_minutos}min` : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "hsl(var(--primary))" },
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
      })),
    [data?.ligacoes],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // ressincroniza quando dados chegam
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // persiste posições ao terminar drag
      for (const c of changes) {
        if (c.type === "position" && !c.dragging && c.position) {
          const isEtapa = !c.id.startsWith("lane-");
          if (isEtapa) {
            salvarPos.mutate({
              id: c.id,
              posicao_x: c.position.x,
              posicao_y: c.position.y,
            });
          }
        }
      }
    },
    [onNodesChange, salvarPos],
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      setEdges((eds) => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
      criarLig.mutate({
        processo_id: processoId,
        de_etapa_id: conn.source,
        para_etapa_id: conn.target,
      });
    },
    [processoId, setEdges, criarLig],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) {
        removerLig.mutate({ id: e.id, processo_id: processoId });
      }
    },
    [processoId, removerLig],
  );

  if (isLoading || !data) {
    return (
      <Card className="h-[600px] flex items-center justify-center text-sm text-muted-foreground">
        Carregando canvas…
      </Card>
    );
  }

  return (
    <Card className="h-[calc(100vh-260px)] min-h-[520px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </Card>
  );
}
