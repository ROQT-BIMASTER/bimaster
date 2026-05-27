import { ReactNode, createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface CentralLayoutProps {
  /** Toolbar contextual (busca, filtros, view-toggle). Container preserva
   *  altura mesmo vazio para manter ancoragem visual entre abas.
   *  Se não passado, abas podem injetar conteúdo via <CentralToolbarPortal>. */
  toolbarSlot?: ReactNode;
  /** Chips de filtro (substituem KPIs). Container preserva altura mesmo vazio.
   *  Abas injetam conteúdo via <CentralChipsPortal>. */
  chipsSlot?: ReactNode;
  /** Conteúdo principal da aba. */
  children: ReactNode;
  className?: string;
}

const ToolbarContainerContext = createContext<HTMLDivElement | null>(null);
const ChipsContainerContext = createContext<HTMLDivElement | null>(null);

/**
 * Shell visual unificado das abas da Central de Trabalho.
 * F1: containers de toolbar e chips com altura reservada.
 * F2: portal de toolbar.
 * F3: portal de chips (substituem CentralKPIs).
 */
export function CentralLayout({
  toolbarSlot,
  chipsSlot,
  children,
  className,
}: CentralLayoutProps) {
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);
  const [chipsContainer, setChipsContainer] = useState<HTMLDivElement | null>(null);

  const toolbarRef = useCallback((node: HTMLDivElement | null) => {
    setToolbarContainer(node);
  }, []);
  const chipsRef = useCallback((node: HTMLDivElement | null) => {
    setChipsContainer(node);
  }, []);

  return (
    <ToolbarContainerContext.Provider value={toolbarContainer}>
      <ChipsContainerContext.Provider value={chipsContainer}>
        <div className={cn("flex flex-col min-h-0", className)}>
          <div
            ref={toolbarRef}
            data-central-slot="toolbar"
            className="flex items-center gap-2 flex-wrap w-full"
            style={{ minHeight: 44 }}
          >
            {toolbarSlot}
          </div>
          <div
            ref={chipsRef}
            data-central-slot="chips"
            className="flex items-center gap-1.5 flex-wrap w-full"
            style={{ minHeight: 36 }}
          >
            {chipsSlot}
          </div>
          <div className="flex-1 min-h-0">{children}</div>
        </div>
      </ChipsContainerContext.Provider>
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

/**
 * Renderiza `children` dentro do slot de chips do CentralLayout pai.
 * Usado pelas abas para expor filtros contextuais como chips clicáveis.
 */
export function CentralChipsPortal({ children }: { children: ReactNode }) {
  const container = useContext(ChipsContainerContext);
  if (!container) return null;
  return createPortal(children, container);
}
