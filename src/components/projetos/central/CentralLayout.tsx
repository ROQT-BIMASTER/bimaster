import { ReactNode, createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface CentralLayoutProps {
  /** Toolbar contextual (busca, filtros, view-toggle). Container preserva
   *  altura mesmo vazio para manter ancoragem visual entre abas.
   *  Se não passado, abas podem injetar conteúdo via <CentralToolbarPortal>. */
  toolbarSlot?: ReactNode;
  /** Chips de filtro (substituirão KPIs em fases futuras). Container
   *  preserva altura mesmo vazio. */
  chipsSlot?: ReactNode;
  /** Conteúdo principal da aba. */
  children: ReactNode;
  className?: string;
}

const ToolbarContainerContext = createContext<HTMLDivElement | null>(null);

/**
 * Shell visual unificado das abas da Central de Trabalho.
 * F1: containers de toolbar e chips com altura reservada.
 * F2: expõe contexto para que abas portalem sua toolbar no slot.
 */
export function CentralLayout({
  toolbarSlot,
  chipsSlot,
  children,
  className,
}: CentralLayoutProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const refCallback = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  return (
    <ToolbarContainerContext.Provider value={container}>
      <div className={cn("flex flex-col min-h-0", className)}>
        <div
          ref={refCallback}
          data-central-slot="toolbar"
          className="flex items-center gap-2 flex-wrap w-full"
          style={{ minHeight: 44 }}
        >
          {toolbarSlot}
        </div>
        <div
          data-central-slot="chips"
          className="flex items-center gap-2"
          style={{ minHeight: 36 }}
        >
          {chipsSlot}
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </ToolbarContainerContext.Provider>
  );
}

/**
 * Renderiza `children` dentro do slot de toolbar do CentralLayout pai.
 * Permite que cada aba mantenha seu estado/handlers locais enquanto a
 * toolbar aparece sempre na mesma posição visual.
 */
export function CentralToolbarPortal({ children }: { children: ReactNode }) {
  const container = useContext(ToolbarContainerContext);
  if (!container) return null;
  return createPortal(children, container);
}
