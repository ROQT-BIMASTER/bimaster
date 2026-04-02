import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ConversasList } from "@/components/chat/ConversasList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Chat = () => {
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleSelectConversa = (id: string) => {
    setConversaSelecionada(id);
  };

  const handleBack = () => {
    setConversaSelecionada(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold tracking-tight">Chat</h2>
          <p className="text-muted-foreground text-sm">Conversas com sua equipe</p>
        </div>

        {isMobile ? (
          <div className="h-[calc(100vh-200px)]">
            {conversaSelecionada ? (
              <div className="h-full flex flex-col">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="self-start mb-2 gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <div className="flex-1 min-h-0">
                  <ChatWindow conversaId={conversaSelecionada} />
                </div>
              </div>
            ) : (
              <ConversasList
                onSelectConversa={handleSelectConversa}
                conversaSelecionada={conversaSelecionada}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
            <div className="col-span-1 h-full">
              <ConversasList
                onSelectConversa={handleSelectConversa}
                conversaSelecionada={conversaSelecionada}
              />
            </div>
            <div className="col-span-2 h-full">
              <ChatWindow conversaId={conversaSelecionada} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Chat;
