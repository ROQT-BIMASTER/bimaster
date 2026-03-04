import { useState } from "react";
import { ProjetoInboxFeed } from "@/components/projetos/ProjetoInboxFeed";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Filter, Inbox } from "lucide-react";

export default function ProjetoInbox() {
  const [activeTab, setActiveTab] = useState("atividade");

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
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Filter className="h-4 w-4" /> Filtrar
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/30">
                <TabsTrigger value="atividade">Atividade</TabsTrigger>
                <TabsTrigger value="mencoes">@Menções</TabsTrigger>
                <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Feed */}
            <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
              {activeTab === "atividade" && <ProjetoInboxFeed />}
              {activeTab === "mencoes" && (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                  Nenhuma menção ainda
                </div>
              )}
              {activeTab === "arquivadas" && (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                  Nenhuma atividade arquivada
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
