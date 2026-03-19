import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Clock, User, Target, RotateCcw, Calendar, Send } from "lucide-react";

interface Atividade {
  id: string;
  tarefa_id: string;
  user_id: string;
  tipo: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  descricao: string | null;
  created_at: string;
  user_nome?: string;
  user_avatar?: string | null;
}

const TIPO_ICONS: Record<string, React.ReactNode> = {
  status_change: <Target className="h-3 w-3" />,
  responsavel_change: <User className="h-3 w-3" />,
  prazo_change: <Calendar className="h-3 w-3" />,
  estagio_change: <ArrowRight className="h-3 w-3" />,
  retrabalho: <RotateCcw className="h-3 w-3" />,
  despacho_processo: <Send className="h-3 w-3 text-primary" />,
};

interface ProjetoAtividadesLogProps {
  tarefaId: string;
  maxHeight?: string;
}

export function ProjetoAtividadesLog({ tarefaId, maxHeight = "300px" }: ProjetoAtividadesLogProps) {
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["tarefa-atividades", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_atividades" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((a: any) => a.user_id).filter(Boolean))];
      let profileMap: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      }

      return (data || []).map((a: any) => ({
        ...a,
        user_nome: profileMap[a.user_id]?.nome || "Sistema",
        user_avatar: profileMap[a.user_id]?.avatar_url || null,
      })) as Atividade[];
    },
    enabled: !!tarefaId,
  });

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-2 flex items-center gap-1"><Clock className="h-3 w-3 animate-spin" /> Carregando histórico...</div>;
  }

  if (atividades.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhuma alteração registrada ainda.</p>;
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="space-y-2">
        {atividades.map(a => (
          <div key={a.id} className="flex items-start gap-2 text-xs">
            <Avatar className="h-5 w-5 mt-0.5 flex-shrink-0">
              <AvatarImage src={a.user_avatar || undefined} />
              <AvatarFallback className="text-[8px] bg-muted">
                {a.user_nome?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-medium">{a.user_nome?.split(" ")[0]}</span>
                <span className="text-muted-foreground">{a.descricao}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })}
              </span>
            </div>
            <div className="flex-shrink-0 text-muted-foreground">
              {TIPO_ICONS[a.tipo] || <Clock className="h-3 w-3" />}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
