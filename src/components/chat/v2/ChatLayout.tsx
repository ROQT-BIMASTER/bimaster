import { useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatThread } from "./ChatThread";
import { ConversaInfoPanel } from "./ConversaInfoPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  initialConversaId?: string | null;
  className?: string;
  /** Mostra painel de info (3ª coluna) — default true em desktop. */
  defaultShowInfo?: boolean;
}

export function ChatLayout({ initialConversaId = null, className, defaultShowInfo = false }: Props) {
  const [conversaId, setConversaId] = useState<string | null>(initialConversaId);
  const [showInfo, setShowInfo] = useState(defaultShowInfo);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("flex h-full w-full bg-background", className)}>
        {!conversaId ? (
          <ChatSidebar conversaSelecionada={null} onSelectConversa={setConversaId} className="w-full" />
        ) : (
          <div className="flex flex-col h-full w-full">
            <div className="px-2 py-1 border-b border-border flex items-center bg-card">
              <Button size="sm" variant="ghost" onClick={() => setConversaId(null)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatThread conversaId={conversaId} onShowInfo={() => setShowInfo(true)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full w-full bg-background overflow-hidden", className)}>
      <ChatSidebar
        conversaSelecionada={conversaId}
        onSelectConversa={(id) => { setConversaId(id); }}
        className="w-[320px] shrink-0"
      />
      <div className="flex-1 min-w-0 flex">
        {conversaId ? (
          <ChatThread conversaId={conversaId} onShowInfo={() => setShowInfo((v) => !v)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <MessageSquare className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Escolha uma conversa na lista ao lado ou crie uma nova para começar a trocar mensagens com sua equipe.
            </p>
          </div>
        )}
        {showInfo && conversaId && (
          <ConversaInfoPanel
            conversaId={conversaId}
            onClose={() => setShowInfo(false)}
            className="w-[300px] shrink-0"
          />
        )}
      </div>
    </div>
  );
}
