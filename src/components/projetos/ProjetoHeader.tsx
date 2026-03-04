import { Projeto } from "@/hooks/useProjetos";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, List, LayoutGrid, Calendar, BarChart3, FileText, Filter, ArrowUpDown } from "lucide-react";

interface ProjetoHeaderProps {
  projeto: Projeto;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function ProjetoHeader({ projeto, activeTab, onTabChange }: ProjetoHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Project title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: projeto.cor }}>
          <span className="text-white text-lg font-bold">{projeto.nome.charAt(0)}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{projeto.nome}</h1>
          {projeto.descricao && <p className="text-sm text-muted-foreground">{projeto.descricao}</p>}
        </div>
      </div>

      {/* Tabs and toolbar */}
      <div className="flex items-center justify-between border-b border-border/50 pb-0">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="lista" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-4 gap-1.5">
              <List className="h-4 w-4" /> Lista
            </TabsTrigger>
            <TabsTrigger value="quadro" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-4 gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Quadro
            </TabsTrigger>
            <TabsTrigger value="cronograma" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-4 gap-1.5">
              <Calendar className="h-4 w-4" /> Cronograma
            </TabsTrigger>
            <TabsTrigger value="painel" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-4 gap-1.5">
              <BarChart3 className="h-4 w-4" /> Painel
            </TabsTrigger>
            <TabsTrigger value="arquivos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 px-4 gap-1.5">
              <FileText className="h-4 w-4" /> Arquivos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 pb-3">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filtrar
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
          </Button>
        </div>
      </div>
    </div>
  );
}
