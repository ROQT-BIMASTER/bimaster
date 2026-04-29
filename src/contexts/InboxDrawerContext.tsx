import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { logger } from "@/lib/logger";

interface InboxDrawerContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const InboxDrawerContext = createContext<InboxDrawerContextValue | null>(null);

export function InboxDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);
  return (
    <InboxDrawerContext.Provider value={{ open, setOpen, openDrawer, closeDrawer, toggleDrawer }}>
      {children}
    </InboxDrawerContext.Provider>
  );
}

/**
 * Fallback noop usado quando o hook é chamado fora do provider.
 * Evita derrubar a tela inteira: registra um aviso e expõe ações inertes
 * para que componentes como o sino de notificações continuem renderizando.
 */
const NOOP_VALUE: InboxDrawerContextValue = {
  open: false,
  setOpen: () => {},
  openDrawer: () => {
    if (typeof window !== "undefined") {
      logger.warn(
        "[useInboxDrawer] Provider ausente — abrir Caixa de Entrada não disponível neste contexto.",
      );
    }
  },
  closeDrawer: () => {},
  toggleDrawer: () => {},
};

/**
 * Lê o contexto da Caixa de Entrada.
 *
 * Caso o componente seja renderizado fora do `InboxDrawerProvider`
 * (por exemplo em telas legadas ou portais isolados), retornamos um
 * fallback inerte em vez de lançar — assim a UI não quebra.
 */
export function useInboxDrawer() {
  const ctx = useContext(InboxDrawerContext);
  return ctx ?? NOOP_VALUE;
}
