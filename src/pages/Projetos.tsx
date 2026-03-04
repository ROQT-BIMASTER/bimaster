import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjetos, Projeto } from "@/hooks/useProjetos";
import { NovoProjetoDialog } from "@/components/projetos/NovoProjetoDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FolderOpen, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Projetos() {
  const { projetos, isLoading, deleteProjeto } = useProjetos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
                  <p className="text-sm text-muted-foreground">Gerencie seus projetos e equipes</p>
                </div>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Projeto
              </Button>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state */}
            {!isLoading && projetos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FolderOpen className="h-16 w-16 mb-4 opacity-30" />
                <p className="font-medium text-lg">Nenhum projeto ainda</p>
                <p className="text-sm mb-4">Crie seu primeiro projeto para começar</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Criar Projeto
                </Button>
              </div>
            )}

            {/* Project grid */}
            {!isLoading && projetos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projetos.map(projeto => (
                  <Card
                    key={projeto.id}
                    className="cursor-pointer hover:shadow-lg transition-all group relative"
                    onClick={() => navigate(`/dashboard/projetos/${projeto.id}`)}
                  >
                    <div className="h-2 rounded-t-xl" style={{ backgroundColor: projeto.cor }} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: projeto.cor }}>
                            <span className="text-white font-bold">{projeto.nome.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{projeto.nome}</h3>
                            {projeto.descricao && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{projeto.descricao}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => deleteProjeto.mutate(projeto.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <NovoProjetoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarProvider>
  );
}
