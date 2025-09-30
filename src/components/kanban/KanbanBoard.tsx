import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ProspectCard } from "./ProspectCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
}

const STAGES = [
  { id: "novo", label: "Novo", color: "bg-blue-500" },
  { id: "em_contato", label: "Em Contato", color: "bg-cyan-500" },
  { id: "proposta_enviada", label: "Proposta Enviada", color: "bg-purple-500" },
  { id: "negociacao", label: "Negociação", color: "bg-yellow-500" },
  { id: "ganho", label: "Ganho", color: "bg-green-500" },
  { id: "perdido", label: "Perdido", color: "bg-red-500" },
];

export const KanbanBoard = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    try {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProspects(data || []);
    } catch (error) {
      console.error("Erro ao carregar prospects:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prospects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const prospectId = active.id as string;
    const newStatus = over.id as string;

    // Verificar se é um status válido
    const validStage = STAGES.find((stage) => stage.id === newStatus);
    if (!validStage) return;

    // Atualizar localmente primeiro para feedback imediato
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, status: newStatus } : p))
    );

    // Atualizar no banco com o tipo correto
    try {
      const { error } = await supabase
        .from("prospects")
        .update({ 
          status: newStatus as "novo" | "em_contato" | "proposta_enviada" | "negociacao" | "ganho" | "perdido"
        })
        .eq("id", prospectId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "O prospect foi movido com sucesso",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      // Reverter mudança local em caso de erro
      fetchProspects();
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const getProspectsByStatus = (status: string) => {
    return prospects.filter((p) => p.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeProspect = prospects.find((p) => p.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAGES.map((stage) => {
          const stageProspects = getProspectsByStatus(stage.id);
          return (
            <SortableContext
              key={stage.id}
              id={stage.id}
              items={stageProspects.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <Card className="flex flex-col h-full min-h-[500px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {stage.label}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {stageProspects.length}
                    </Badge>
                  </div>
                  <div className={`h-1 w-full rounded-full ${stage.color}`} />
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-3">
                  {stageProspects.map((prospect) => (
                    <ProspectCard key={prospect.id} prospect={prospect} />
                  ))}
                  {stageProspects.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                      Arraste prospects aqui
                    </div>
                  )}
                </CardContent>
              </Card>
            </SortableContext>
          );
        })}
      </div>

      <DragOverlay>
        {activeProspect ? <ProspectCard prospect={activeProspect} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
