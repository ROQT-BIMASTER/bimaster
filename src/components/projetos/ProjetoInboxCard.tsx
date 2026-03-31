import { ProjetoAtividade } from "@/hooks/useProjetoAtividades";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare, Archive, CheckCircle2, UserPlus, FolderPlus, ArrowRight, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const TIPO_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  criou_tarefa: { icon: FolderPlus, label: "adicionou tarefa", color: "text-blue-400" },
  completou: { icon: CheckCircle2, label: "completou", color: "text-emerald-400" },
  comentou: { icon: MessageSquare, label: "comentou em", color: "text-amber-400" },
  compartilhou: { icon: UserPlus, label: "compartilhou", color: "text-violet-400" },
  moveu: { icon: ArrowRight, label: "moveu", color: "text-cyan-400" },
};

interface ProjetoInboxCardProps {
  atividade: ProjetoAtividade;
}

export function ProjetoInboxCard({ atividade }: ProjetoInboxCardProps) {
  const config = TIPO_CONFIG[atividade.tipo] || TIPO_CONFIG.criou_tarefa;
  const Icon = config.icon;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const marcarLida = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (atividade.lida) return;
    await supabase.from("projeto_atividades").update({ lida: true }).eq("id", atividade.id);
    queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
  };

  const handleClick = async () => {
    if (!atividade.lida) {
      await supabase.from("projeto_atividades").update({ lida: true }).eq("id", atividade.id);
      queryClient.invalidateQueries({ queryKey: ["projeto-atividades"] });
    }
    navigate(`/dashboard/projetos/${atividade.projeto_id}`);
  };

  return (
    <div 
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 group cursor-pointer",
        !atividade.lida && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      <div className="w-2 pt-2 flex-shrink-0">
        {!atividade.lida && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>

      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
        <AvatarImage src={atividade.user_avatar || undefined} />
        <AvatarFallback className="text-xs bg-muted">{atividade.user_nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium text-foreground">{atividade.user_nome}</span>
          {" "}
          <span className="text-muted-foreground">{config.label}</span>
          {atividade.descricao && (
            <span className="text-foreground"> "{atividade.descricao}"</span>
          )}
          {" "}
          <span className="text-muted-foreground">em</span>
          {" "}
          <span className="font-medium text-primary">{atividade.projeto_nome}</span>
        </p>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(atividade.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>

      {/* Icon */}
      <Icon className={cn("h-4 w-4 mt-1 flex-shrink-0", config.color)} />

      {/* Quick actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        {!atividade.lida && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como lida" onClick={marcarLida}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7"><ThumbsUp className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Archive className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
