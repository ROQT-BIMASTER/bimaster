import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight, Clock, User, Target, RotateCcw, Calendar, Send,
  PenLine, FileText, FolderOpen, ShieldCheck, Plus, AlertTriangle,
  Flag, ArrowUpDown
} from "lucide-react";

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

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  criacao:            { icon: <Plus className="h-3 w-3" />,          color: "bg-emerald-500/20 text-emerald-400", label: "Criação" },
  status_change:      { icon: <Target className="h-3 w-3" />,       color: "bg-blue-500/20 text-blue-400",       label: "Status" },
  prioridade_change:  { icon: <Flag className="h-3 w-3" />,         color: "bg-amber-500/20 text-amber-400",     label: "Prioridade" },
  estagio_change:     { icon: <ArrowRight className="h-3 w-3" />,   color: "bg-purple-500/20 text-purple-400",   label: "Estágio" },
  responsavel_change: { icon: <User className="h-3 w-3" />,         color: "bg-pink-500/20 text-pink-400",       label: "Responsável" },
  prazo_change:       { icon: <Calendar className="h-3 w-3" />,     color: "bg-orange-500/20 text-orange-400",   label: "Prazo" },
  titulo_change:      { icon: <PenLine className="h-3 w-3" />,      color: "bg-sky-500/20 text-sky-400",         label: "Título" },
  descricao_change:   { icon: <FileText className="h-3 w-3" />,     color: "bg-slate-500/20 text-slate-400",     label: "Descrição" },
  secao_change:       { icon: <FolderOpen className="h-3 w-3" />,   color: "bg-teal-500/20 text-teal-400",       label: "Seção" },
  inicio_change:      { icon: <Calendar className="h-3 w-3" />,     color: "bg-indigo-500/20 text-indigo-400",   label: "Início" },
  validacao_change:   { icon: <ShieldCheck className="h-3 w-3" />,  color: "bg-emerald-500/20 text-emerald-400", label: "Validação" },
  retrabalho:         { icon: <RotateCcw className="h-3 w-3" />,    color: "bg-red-500/20 text-red-400",         label: "Retrabalho" },
  despacho_processo:  { icon: <Send className="h-3 w-3" />,         color: "bg-primary/20 text-primary",         label: "Despacho" },
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em Andamento", concluida: "Concluída",
  bloqueada: "Bloqueada", cancelada: "Cancelada",
};
const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

function formatFieldValue(campo: string | null, valor: string | null): string {
  if (!valor) return "—";
  if (campo === "status") return STATUS_LABELS[valor] || valor;
  if (campo === "prioridade") return PRIORIDADE_LABELS[valor] || valor;
  if (campo === "data_prazo" || campo === "data_inicio_planejada") {
    try { return format(new Date(valor), "dd/MM/yyyy"); } catch { return valor; }
  }
  return valor.length > 40 ? valor.substring(0, 40) + "…" : valor;
}

interface ProjetoAtividadesLogProps {
  tarefaId: string;
  maxHeight?: string;
}

export function ProjetoAtividadesLog({ tarefaId, maxHeight = "400px" }: ProjetoAtividadesLogProps) {
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["tarefa-atividades", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_atividades" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false })
        .limit(100);
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
    <TooltipProvider>
      <ScrollArea style={{ maxHeight }}>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border/50" />

          <div className="space-y-3">
            {atividades.map(a => {
              const config = TIPO_CONFIG[a.tipo] || { icon: <Clock className="h-3 w-3" />, color: "bg-muted text-muted-foreground", label: a.tipo };
              const hasValues = a.valor_anterior || a.valor_novo;
              const firstName = a.user_nome?.split(" ")[0] || "Sistema";

              return (
                <div key={a.id} className="flex items-start gap-3 text-xs relative pl-1">
                  {/* Timeline dot */}
                  <div className={cn("h-[26px] w-[26px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-background", config.color)}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground">{firstName}</span>
                      <span className="text-muted-foreground">{a.descricao}</span>
                      <Badge variant="ghost" className="text-[9px] px-1.5 py-0 h-4">
                        {config.label}
                      </Badge>
                    </div>

                    {/* Before → After values */}
                    {hasValues && a.tipo !== "criacao" && a.tipo !== "descricao_change" && (
                      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                        {a.valor_anterior && (
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive line-through">
                            {formatFieldValue(a.campo, a.valor_anterior)}
                          </span>
                        )}
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">
                          {formatFieldValue(a.campo, a.valor_novo)}
                        </span>
                      </div>
                    )}

                    {/* Timestamp with tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground/70 mt-0.5 inline-block cursor-default">
                          {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
