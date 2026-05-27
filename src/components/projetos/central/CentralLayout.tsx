import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CentralLayoutProps {
  /** Toolbar contextual (busca, filtros, view-toggle). Container preserva
   *  altura mesmo vazio para manter ancoragem visual entre abas. */
  toolbarSlot?: ReactNode;
  /** Chips de filtro (substituirão KPIs em fases futuras). Container
   *  preserva altura mesmo vazio. */
  chipsSlot?: ReactNode;
  /** Conteúdo principal da aba. */
  children: ReactNode;
  className?: string;
}

/**
 * Shell visual unificado das abas da Central de Trabalho.
 * F1: introduz containers de toolbar e chips com altura reservada,
 * sem ainda preencher conteúdo (fases F2/F3 cuidam disso).
 */
export function CentralLayout({
  toolbarSlot,
  chipsSlot,
  children,
  className,
}: CentralLayoutProps) {
  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div
        data-central-slot="toolbar"
        className="flex items-center gap-2"
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
  );
}
