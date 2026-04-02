import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectCard } from "./ProspectCard";

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
  vendedor?: { nome: string } | null;
}

interface KanbanColumnProps {
  stage: {
    id: string;
    label: string;
    color: string;
  };
  prospects: Prospect[];
  onProspectClick: (prospect: Prospect) => void;
}

export const KanbanColumn = ({ stage, prospects, onProspectClick }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <Card 
      ref={setNodeRef}
      className={`flex flex-col h-full min-h-[500px] min-w-[280px] snap-center md:min-w-0 md:snap-align-none transition-colors ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {stage.label}
          </CardTitle>
          <Badge variant="secondary" className="ml-2">
            {prospects.length}
          </Badge>
        </div>
        <div className={`h-1 w-full rounded-full ${stage.color}`} />
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3">
        <SortableContext
          items={prospects.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {prospects.map((prospect) => (
            <ProspectCard 
              key={prospect.id} 
              prospect={prospect}
              onClick={() => onProspectClick(prospect)}
            />
          ))}
          {prospects.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Arraste prospects aqui
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
};
