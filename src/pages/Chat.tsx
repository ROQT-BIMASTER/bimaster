import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ConversasList } from "@/components/chat/ConversasList";
import { ChatWindow } from "@/components/chat/ChatWindow";

const Chat = () => {
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Chat</h2>
          <p className="text-muted-foreground">Conversas com sua equipe</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          <div className="md:col-span-1 h-full">
            <ConversasList
              onSelectConversa={setConversaSelecionada}
              conversaSelecionada={conversaSelecionada}
            />
          </div>
          <div className="md:col-span-2 h-full">
            <ChatWindow conversaId={conversaSelecionada} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Chat;
