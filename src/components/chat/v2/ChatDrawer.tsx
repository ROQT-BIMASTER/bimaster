import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatUnreadTotal } from "@/hooks/chat/useConversas";
import { ChatLayout } from "./ChatLayout";
import { Badge } from "@/components/ui/badge";
import { useBrowserPathname } from "@/hooks/useBrowserPathname";
import { ChatErrorBoundary } from "./ChatErrorBoundary";

interface ChatDrawerCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  abrir: (conversaId?: string) => void;
}
const Ctx = createContext<ChatDrawerCtx | null>(null);

export function useChatDrawer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChatDrawer fora do provider");
  return v;
}

export function ChatDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialId, setInitialId] = useState<string | null>(null);

  const abrir = useCallback((conversaId?: string) => {
    if (conversaId) setInitialId(conversaId);
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={{ open, setOpen, abrir }}>
      {children}
      <ChatErrorBoundary name="ChatFloatingButton" fallback={null}>
        <ChatFloatingButton />
      </ChatErrorBoundary>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[920px] p-0 gap-0 flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold flex-1">Chat</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            {open && (
              <ChatErrorBoundary name="ChatLayout">
                <ChatLayout initialConversaId={initialId} />
              </ChatErrorBoundary>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}

function ChatFloatingButton() {
  const { user } = useAuth();
  const { abrir } = useChatDrawer();
  const total = useChatUnreadTotal();
  const pathname = usePathname();
  const [shortcut, setShortcut] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abrir]);

  if (!user) return null;
  // Esconde na própria página /chat (já tem layout dedicado)
  if (pathname.startsWith("/dashboard/chat")) return null;
  if (!pathname.startsWith("/dashboard")) return null;

  return (
    <button
      onClick={() => abrir()}
      onMouseEnter={() => setShortcut(true)}
      onMouseLeave={() => setShortcut(false)}
      className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      title="Chat (Ctrl+Shift+M)"
    >
      <MessageCircle className="h-5 w-5" />
      {total > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] rounded-full bg-emerald-600 hover:bg-emerald-600">
          {total > 99 ? "99+" : total}
        </Badge>
      )}
      {shortcut && (
        <span className="absolute right-14 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow whitespace-nowrap border border-border">
          Chat <span className="text-muted-foreground ml-1">Ctrl+Shift+M</span>
        </span>
      )}
    </button>
  );
}
