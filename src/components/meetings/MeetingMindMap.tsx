import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Lightbulb, CheckCircle2, ListTodo, ShieldAlert,
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ===== Types =====
interface MindMapNode {
  label: string;
  type?: "problema" | "oportunidade" | "decisao" | "tarefa" | "risco" | "root" | "category";
  children?: MindMapNode[];
}

interface MindMapData {
  root: string;
  children: MindMapNode[];
}

interface PositionedNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  depth: number;
}

interface MeetingMindMapProps {
  mermaidCode?: string | null;
}

// ===== Style config =====
const NODE_STYLES: Record<string, { bg: string; border: string; text: string; icon: any; glow: string }> = {
  root: { bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", icon: null, glow: "shadow-[0_0_24px_hsl(var(--primary)/0.3)]" },
  problema: { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", icon: AlertTriangle, glow: "shadow-[0_0_12px_hsl(var(--destructive)/0.15)]" },
  oportunidade: { bg: "bg-success/10", border: "border-success/40", text: "text-success", icon: Lightbulb, glow: "shadow-[0_0_12px_hsl(var(--success)/0.15)]" },
  decisao: { bg: "bg-primary/10", border: "border-primary/40", text: "text-primary", icon: CheckCircle2, glow: "shadow-[0_0_12px_hsl(var(--primary)/0.15)]" },
  tarefa: { bg: "bg-warning/10", border: "border-warning/40", text: "text-warning", icon: ListTodo, glow: "shadow-[0_0_12px_hsl(var(--warning)/0.15)]" },
  risco: { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-600", icon: ShieldAlert, glow: "shadow-[0_0_12px_rgba(249,115,22,0.15)]" },
  category: { bg: "bg-muted", border: "border-border", text: "text-foreground", icon: null, glow: "" },
};

const STROKE_COLORS: Record<string, string> = {
  root: "hsl(var(--primary))",
  problema: "hsl(var(--destructive))",
  oportunidade: "hsl(var(--success))",
  decisao: "hsl(var(--primary))",
  tarefa: "hsl(var(--warning))",
  risco: "#f97316",
  category: "hsl(var(--border))",
};

// ===== Layout calculation =====
const NODE_W = 180;
const NODE_H = 48;
const H_GAP = 60;
const V_GAP = 24;

function layoutTree(data: MindMapData): { nodes: PositionedNode[]; width: number; height: number } {
  const nodes: PositionedNode[] = [];
  let idCounter = 0;

  function measure(node: MindMapNode, depth: number): number {
    const children = node.children || [];
    if (children.length === 0) return 1;
    return children.reduce((sum, c) => sum + measure(c, depth + 1), 0);
  }

  function place(node: MindMapNode, depth: number, yStart: number, parentId?: string): number {
    const id = `n${idCounter++}`;
    const children = node.children || [];
    const leafCount = measure(node, depth);
    const totalHeight = leafCount * (NODE_H + V_GAP) - V_GAP;
    const x = depth * (NODE_W + H_GAP);
    const y = yStart + totalHeight / 2 - NODE_H / 2;

    nodes.push({
      id, label: node.label, type: node.type || (depth === 0 ? "root" : "category"),
      x, y, width: NODE_W, height: NODE_H, parentId, depth,
    });

    let childY = yStart;
    for (const child of children) {
      const childLeafCount = measure(child, depth + 1);
      const childTotalHeight = childLeafCount * (NODE_H + V_GAP) - V_GAP;
      place(child, depth + 1, childY, id);
      childY += childTotalHeight + V_GAP;
    }

    return totalHeight;
  }

  const rootNode: MindMapNode = { label: data.root, type: "root", children: data.children };
  const totalHeight = place(rootNode, 0, 0);
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const totalWidth = (maxDepth + 1) * (NODE_W + H_GAP);

  return { nodes, width: totalWidth, height: totalHeight + NODE_H };
}

// ===== Parse input =====
function parseData(input: string | null | undefined): MindMapData | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed.root && Array.isArray(parsed.children)) return parsed as MindMapData;
  } catch {
    // not JSON — ignore legacy mermaid
  }
  return null;
}

// ===== Component =====
export function MeetingMindMap({ mermaidCode }: MeetingMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 40, y: 40 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [fullscreen, setFullscreen] = useState(false);

  const data = useMemo(() => parseData(mermaidCode), [mermaidCode]);
  const layout = useMemo(() => (data ? layoutTree(data) : null), [data]);

  // Fit to container on mount
  useEffect(() => {
    if (!layout || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 80;
    const scaleX = (rect.width - padding) / (layout.width + padding);
    const scaleY = (rect.height - padding) / (layout.height + padding);
    const fitScale = Math.min(scaleX, scaleY, 1);
    setScale(Math.max(fitScale, 0.3));
    setTranslate({
      x: (rect.width - layout.width * fitScale) / 2,
      y: (rect.height - layout.height * fitScale) / 2,
    });
  }, [layout, fullscreen]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 0.2), 2));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [translate]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setTranslate({
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  const resetView = useCallback(() => {
    if (!layout || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 80;
    const scaleX = (rect.width - padding) / (layout.width + padding);
    const scaleY = (rect.height - padding) / (layout.height + padding);
    const fitScale = Math.min(scaleX, scaleY, 1);
    setScale(Math.max(fitScale, 0.3));
    setTranslate({
      x: (rect.width - layout.width * fitScale) / 2,
      y: (rect.height - layout.height * fitScale) / 2,
    });
  }, [layout]);

  if (!data || !layout) {
    // Fallback for legacy mermaid or empty
    if (mermaidCode) {
      return (
        <div className="overflow-auto max-h-[500px]">
          <pre className="text-xs p-4 rounded-lg bg-muted text-muted-foreground whitespace-pre-wrap">{mermaidCode}</pre>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Nenhum mapa mental disponível
      </div>
    );
  }

  const wrapperClass = fullscreen
    ? "fixed inset-0 z-50 bg-background"
    : "relative rounded-xl border border-border bg-muted/30 overflow-hidden";

  return (
    <div className={wrapperClass} style={{ height: fullscreen ? "100vh" : 500 }}>
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm" onClick={() => setScale((s) => Math.min(s + 0.15, 2))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm" onClick={() => setScale((s) => Math.max(s - 0.15, 0.2))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm" onClick={resetView}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm" onClick={() => setFullscreen((f) => !f)}>
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        <div style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
          {/* SVG connections */}
          <svg
            width={layout.width + 100}
            height={layout.height + 100}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ overflow: "visible" }}
          >
            {layout.nodes
              .filter((n) => n.parentId)
              .map((node) => {
                const parent = layout.nodes.find((p) => p.id === node.parentId)!;
                const x1 = parent.x + parent.width;
                const y1 = parent.y + parent.height / 2;
                const x2 = node.x;
                const y2 = node.y + node.height / 2;
                const cx = (x1 + x2) / 2;
                const strokeColor = STROKE_COLORS[node.type] || STROKE_COLORS.category;

                return (
                  <motion.path
                    key={`${node.parentId}-${node.id}`}
                    d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={2}
                    strokeOpacity={0.5}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: node.depth * 0.15 }}
                  />
                );
              })}
          </svg>

          {/* Nodes */}
          {layout.nodes.map((node, i) => {
            const style = NODE_STYLES[node.type] || NODE_STYLES.category;
            const IconComp = style.icon;
            const isRoot = node.type === "root";

            return (
              <motion.div
                key={node.id}
                className={`absolute flex items-center gap-2 px-3 rounded-xl border-2 ${style.bg} ${style.border} ${style.glow} ${isRoot ? "font-bold" : "font-medium"}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                {IconComp && <IconComp className={`h-4 w-4 shrink-0 ${style.text}`} />}
                <span className={`text-xs leading-tight truncate ${isRoot ? "text-primary-foreground" : style.text}`}>
                  {node.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
