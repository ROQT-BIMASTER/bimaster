import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface ProspectCardProps {
  prospect: Prospect;
}

export const ProspectCard = ({ prospect }: ProspectCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getCategoriaColor = (categoria: string | null) => {
    switch (categoria) {
      case "A":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
      case "B":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
      case "C":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "D":
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
      default:
        return "bg-muted";
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold line-clamp-1">
              {prospect.nome_empresa}
            </CardTitle>
            {prospect.categoria && (
              <Badge variant="outline" className={getCategoriaColor(prospect.categoria)}>
                {prospect.categoria}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {prospect.contato_principal && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{prospect.contato_principal}</span>
            </div>
          )}
          {prospect.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{prospect.email}</span>
            </div>
          )}
          {prospect.telefone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="truncate">{prospect.telefone}</span>
            </div>
          )}
          {prospect.proxima_acao && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-3 w-3 text-primary" />
              <span className="font-medium text-primary">
                {format(new Date(prospect.proxima_acao), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
