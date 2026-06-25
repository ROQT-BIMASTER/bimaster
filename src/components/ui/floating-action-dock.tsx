import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Dock global no canto inferior direito que recebe FABs flutuantes
 * (Chat, Copiloto, Tour). Cada FAB usa <FloatingActionSlot> para se
 * portar para dentro do dock — evita sobreposição e mantém z-index/gap
 * consistentes em todas as telas.
 *
 * Ordem visual (de baixo para cima): primeiro filho montado fica no
 * canto, próximos empilham para cima.
 */
export const FAB_DOCK_ID = "fab-dock-root";

export function FloatingActionDock() {
  return (
    <div
      id={FAB_DOCK_ID}
      className="fixed bottom-20 right-5 z-50 flex flex-col-reverse items-end gap-3 pointer-events-none"
    />
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
