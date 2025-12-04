import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Eye, Edit2, ArrowRight, MoreHorizontal, CheckCircle, Clock, Rocket, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickActionsProps {
  lancamentoId: string;
  currentStatus: string;
  onView: () => void;
  onEdit?: () => void;
  onStatusChange?: () => void;
  variant?: "buttons" | "dropdown";
  className?: string;
}

const statusTransitions: Record<string, { next: string; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  planejado: [
    { next: "em_preparacao", label: "Iniciar Preparação", icon: Clock },
  ],
  em_preparacao: [
    { next: "aprovado", label: "Aprovar", icon: CheckCircle },
    { next: "planejado", label: "Voltar para Planejado", icon: ArrowRight },
  ],
  aprovado: [
    { next: "lancado", label: "Marcar como Lançado", icon: Rocket },
    { next: "em_preparacao", label: "Voltar para Preparação", icon: ArrowRight },
  ],
  lancado: [],
  cancelado: [
    { next: "planejado", label: "Reativar", icon: ArrowRight },
  ],
};

export default function QuickActions({
  lancamentoId,
  currentStatus,
  onView,
  onEdit,
  onStatusChange,
  variant = "buttons",
  className,
}: QuickActionsProps) {
  const [loading, setLoading] = useState(false);
  const transitions = statusTransitions[currentStatus] || [];

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const updateData: Record<string, string | null> = { status: newStatus };
      
      // If marking as launched, set data_efetiva
      if (newStatus === "lancado") {
        updateData.data_efetiva = new Date().toISOString();
      }

      const { error } = await supabase
        .from("lancamentos_produtos")
        .update(updateData)
        .eq("id", lancamentoId);

      if (error) throw error;
      
      toast.success("Status atualizado com sucesso!");
      onStatusChange?.();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("lancamentos_produtos")
        .update({ status: "cancelado" })
        .eq("id", lancamentoId);

      if (error) throw error;
      
      toast.success("Lançamento cancelado");
      onStatusChange?.();
    } catch (error) {
      console.error("Error canceling:", error);
      toast.error("Erro ao cancelar");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", className)}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalhes
          </DropdownMenuItem>
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
          
          {transitions.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {transitions.map(({ next, label, icon: Icon }) => (
                <DropdownMenuItem 
                  key={next} 
                  onClick={() => handleStatusChange(next)}
                  disabled={loading}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {currentStatus !== "cancelado" && currentStatus !== "lancado" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleCancel}
                disabled={loading}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Lançamento
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
        <Eye className="h-3.5 w-3.5" />
      </Button>
      {onEdit && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      )}
      {transitions.slice(0, 1).map(({ next, icon: Icon }) => (
        <Button 
          key={next}
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-primary"
          onClick={() => handleStatusChange(next)}
          disabled={loading}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );
}
