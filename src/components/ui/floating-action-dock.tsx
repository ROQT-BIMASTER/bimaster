import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dock global que recebe FABs flutuantes (Chat, Copiloto, Tour). Cada FAB usa
 * <FloatingActionSlot> para se portar para dentro do dock — evita sobreposição
 * e mantém z-index/gap consistentes em todas as telas.
 *
 * Pedido dos usuários: os ícones atrapalhavam cliques no conteúdo atrás. O dock
 * agora pode ser arrastado pela alça e recolhido; posição e estado ficam
 * persistidos em localStorage por navegador.
 */
export const FAB_DOCK_ID = "fab-dock-root";

const POS_KEY = "fab-dock:pos";
const COLLAPSED_KEY = "fab-dock:collapsed";

interface DockPos {
  /** Distância da borda direita, em px. */
  right: number;
  /** Distância da borda inferior, em px. */
  bottom: number;
}

const DEFAULT_POS: DockPos = { right: 20, bottom: 80 };

function clampPos(pos: DockPos): DockPos {
  if (typeof window === "undefined") return pos;
  const maxRight = Math.max(0, window.innerWidth - 80);
  const maxBottom = Math.max(0, window.innerHeight - 120);
  return {
    right: Math.min(Math.max(0, pos.right), maxRight),
    bottom: Math.min(Math.max(0, pos.bottom), maxBottom),
  };
}

function readPos(): DockPos {
  if (typeof window === "undefined") return DEFAULT_POS;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DockPos;
      if (typeof parsed?.right === "number" && typeof parsed?.bottom === "number") {
        return clampPos(parsed);
      }
    }
  } catch {
    /* noop */
  }
  return DEFAULT_POS;
}

export function FloatingActionDock() {
  const [pos, setPos] = useState<DockPos>(() => readPos());
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; base: DockPos } | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persist = useCallback((next: DockPos) => {
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, base: pos };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const next = clampPos({
      right: d.base.right - (e.clientX - d.startX),
      bottom: d.base.bottom - (e.clientY - d.startY),
    });
    setPos(next);
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    setPos((p) => {
      persist(p);
      return p;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div
      className="fixed z-50 flex flex-col items-end gap-2 pointer-events-none"
      style={{ right: pos.right, bottom: pos.bottom }}
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm px-1 py-0.5">
        <button
          type="button"
          aria-label="Arrastar atalhos flutuantes"
          title="Arrastar para reposicionar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors touch-none",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={collapsed ? "Mostrar atalhos flutuantes" : "Ocultar atalhos flutuantes"}
          aria-expanded={!collapsed}
          title={collapsed ? "Mostrar atalhos" : "Ocultar atalhos"}
          onClick={toggleCollapsed}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div
        id={FAB_DOCK_ID}
        className={cn(
          "flex flex-col-reverse items-end gap-3 pointer-events-none",
          collapsed && "hidden",
        )}
      />
    </div>
  );
}

interface FloatingActionSlotProps {
  /** Ordem desejada dentro do dock (menor = mais perto do canto inferior). */
  order?: number;
  children: ReactNode;
}

export function FloatingActionSlot({ order = 0, children }: FloatingActionSlotProps) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Resolve o target após mount; tenta de novo no próximo tick se ainda
    // não existir (caso o consumidor monte antes do <FloatingActionDock />).
    const resolve = () => {
      const el = document.getElementById(FAB_DOCK_ID);
      if (el) setTarget(el);
    };
    resolve();
    if (!document.getElementById(FAB_DOCK_ID)) {
      const t = setTimeout(resolve, 0);
      return () => clearTimeout(t);
    }
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="pointer-events-auto" style={{ order }}>
      {children}
    </div>,
    target,
  );
}
