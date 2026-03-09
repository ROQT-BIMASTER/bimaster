import { useState } from "react";
import { Projeto } from "@/hooks/useProjetos";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, List, LayoutGrid, Calendar, CalendarDays, BarChart3, FileText, FileSpreadsheet, Filter, ArrowUpDown, ShieldCheck, Sparkles, Users, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { ResumoIADialog } from "./ResumoIADialog";
import { ProjetoHealthPanel } from "./ProjetoHealthPanel";
import { ProjetoMembrosDialog } from "./ProjetoMembrosDialog";

interface ProjetoHeaderProps {
  projeto: Projeto;
  activeTab: string;
  onTabChange: (tab: string) => void;
  tarefas?: ProjetoTarefa[];
  customBg?: boolean;
  darkBg?: boolean;
}

export function ProjetoHeader({ projeto, activeTab, onTabChange, tarefas = [], customBg = false, darkBg = false }: ProjetoHeaderProps) {
  const textColor = darkBg ? "text-white" : customBg ? "text-black" : "";
  const textMuted = darkBg ? "text-white/70" : customBg ? "text-black/70" : "text-muted-foreground";
  const borderColor = darkBg ? "border-white/20" : customBg ? "border-black/20" : "border-border/50";
  const tabActive = darkBg ? "data-[state=active]:border-white" : customBg ? "data-[state=active]:border-black" : "data-[state=active]:border-primary";
  const btnHover = darkBg ? "text-white hover:bg-white/10" : customBg ? "text-black hover:bg-black/10" : "";
  const navigate = useNavigate();
  const { getProjectSummary, loading } = useProjetoIA();
  const [resumoOpen, setResumoOpen] = useState(false);
  const [membrosOpen, setMembrosOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Project title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: projeto.cor }}>
          <span className="text-white text-lg font-bold">{projeto.nome.charAt(0)}</span>
        </div>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${textColor || "text-foreground"}`}>{projeto.nome}</h1>
          {projeto.descricao && <p className={`text-sm ${textMuted}`}>{projeto.descricao}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs ${btnHover || (customBg ? "text-black border-black/20 hover:bg-black/10" : "")}`}
            onClick={() => setMembrosOpen(true)}
          >
            <Users className="h-3.5 w-3.5" />
            Membros
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs ${btnHover || (customBg ? "text-black border-black/20 hover:bg-black/10" : "")}`}
            onClick={() => setResumoOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Resumo IA
          </Button>
        </div>
      </div>

      {/* Health Panel */}
      {tarefas.length > 0 && <ProjetoHealthPanel tarefas={tarefas} darkBg={darkBg} />}

      {/* Tabs and toolbar */}
      <div className={`flex items-center justify-between border-b pb-0 ${borderColor}`}>
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="lista" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <List className="h-4 w-4" /> Lista
            </TabsTrigger>
            <TabsTrigger value="quadro" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <LayoutGrid className="h-4 w-4" /> Quadro
            </TabsTrigger>
            <TabsTrigger value="cronograma" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <Calendar className="h-4 w-4" /> Cronograma
            </TabsTrigger>
            <TabsTrigger value="calendario" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <CalendarDays className="h-4 w-4" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="painel" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <BarChart3 className="h-4 w-4" /> Painel
            </TabsTrigger>
            <TabsTrigger value="briefings" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <FileSpreadsheet className="h-4 w-4" /> Briefings
            </TabsTrigger>
            <TabsTrigger value="equipe" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <UsersRound className="h-4 w-4" /> Equipe
            </TabsTrigger>
            <TabsTrigger value="arquivos" className={`data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none pb-3 px-4 gap-1.5 ${textColor || ""} ${tabActive}`}>
              <FileText className="h-4 w-4" /> Arquivos
            </TabsTrigger>
            <button
              onClick={() => navigate("/dashboard/projetos/aprovacoes")}
              className={`flex items-center gap-1.5 pb-3 px-4 text-sm hover:text-foreground transition-colors ${textMuted}`}
            >
              <ShieldCheck className="h-4 w-4" /> Aprovações
            </button>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 pb-3">
          <Button variant="ghost" size="sm" className={`h-8 text-xs gap-1.5 ${btnHover}`}>
            <Filter className="h-3.5 w-3.5" /> Filtrar
          </Button>
          <Button variant="ghost" size="sm" className={`h-8 text-xs gap-1.5 ${btnHover}`}>
            <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
          </Button>
        </div>
      </div>

      <ResumoIADialog
        open={resumoOpen}
        onOpenChange={setResumoOpen}
        projetoId={projeto.id}
        getProjectSummary={getProjectSummary}
        loading={loading === "project_summary"}
      />

      <ProjetoMembrosDialog
        open={membrosOpen}
        onOpenChange={setMembrosOpen}
        projetoId={projeto.id}
      />
    </div>
  );
}
