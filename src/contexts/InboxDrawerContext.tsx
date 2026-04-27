import { createContext, useContext, useState, ReactNode, useCallback } from "react";

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

export function useInboxDrawer() {
  const ctx = useContext(InboxDrawerContext);
  if (!ctx) throw new Error("useInboxDrawer must be used within InboxDrawerProvider");
  return ctx;
}
