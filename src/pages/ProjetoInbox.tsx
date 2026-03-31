import { useState } from "react";
import { ProjetoInboxFeed } from "@/components/projetos/ProjetoInboxFeed";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Inbox, CheckCheck, Bookmark } from "lucide-react";
import { useProjetoAtividades } from "@/hooks/useProjetoAtividades";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ProjetoInbox() {
  const [activeTab, setActiveTab] = useState("atividade");
  const { atividades, naoLidas } = useProjetoAtividades();
  const queryClient = useQueryClient();

  const handleMarcarTodasLidas = async () => {
    const naoLidasIds = atividades.filter(a => !a.lida).map(a => a.id);
    if (naoLidasIds.length === 0) return;

    const { error } = await supabase
      .from("projeto_atividades")
      .update({ lida: true })
      .in("id", naoLidasIds);

    if (error) { toast.error("Erro ao marcar como lidas"); return; }
    queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
    toast.success(`${naoLidasIds.length} notificações marcadas como lidas`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <Inbox className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold text-foreground">Caixa de Entrada</h1>
                  {naoLidas > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{naoLidas}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {naoLidas > 0 && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleMarcarTodasLidas}>
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/30">
                <TabsTrigger value="atividade" className="gap-1.5">
                  Atividade
                  {naoLidas > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{naoLidas}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="mencoes">@Menções</TabsTrigger>
                <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Feed */}
            <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
              {activeTab === "atividade" && <ProjetoInboxFeed />}
              {activeTab === "mencoes" && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Bookmark className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium text-sm">Nenhuma menção ainda</p>
                  <p className="text-xs">Quando alguém mencionar você, aparecerá aqui</p>
                </div>
              )}
              {activeTab === "arquivadas" && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium text-sm">Nenhuma atividade arquivada</p>
                  <p className="text-xs">Arquive notificações para limpá-las da sua caixa</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
