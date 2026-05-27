import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight, Clock, User, Target, RotateCcw, Calendar,
  PenLine, FileText, FolderOpen, ShieldCheck, Plus, Flag,
  MessageSquare, Send, History, Ship, UserPlus, UserMinus,
  ChevronDown, ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface TimelineItem {
  id: string;
  type: "comment" | "activity";
  created_at: string;
  user_nome: string;
  user_avatar: string | null;
  // comment fields
  conteudo?: string;
  // activity fields
  tipo?: string;
  campo?: string | null;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  descricao?: string | null;
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
  despacho_processo:           { icon: <Send className="h-3 w-3" />,         color: "bg-primary/20 text-primary",         label: "Despacho" },
  documento_china_vinculado:   { icon: <Ship className="h-3 w-3" />,         color: "bg-cyan-500/20 text-cyan-400",       label: "Doc. China" },
  documento_china_desvinculado:{ icon: <Ship className="h-3 w-3" />,         color: "bg-rose-500/20 text-rose-400",       label: "Doc. China removido" },
  processo_vinculado:          { icon: <FileText className="h-3 w-3" />,     color: "bg-indigo-500/20 text-indigo-400",   label: "Processo +" },
  processo_desvinculado:       { icon: <FileText className="h-3 w-3" />,     color: "bg-rose-500/20 text-rose-400",       label: "Processo -" },
  seguidor_adicionado:         { icon: <UserPlus className="h-3 w-3" />,     color: "bg-emerald-500/20 text-emerald-400", label: "Seguidor +" },
  seguidor_removido:           { icon: <UserMinus className="h-3 w-3" />,    color: "bg-rose-500/20 text-rose-400",       label: "Seguidor -" },
  sistema:                     { icon: <History className="h-3 w-3" />,      color: "bg-muted text-muted-foreground",     label: "Sistema" },
};

const USER_REF_TIPOS = new Set(["responsavel_change", "seguidor_adicionado", "seguidor_removido"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProjetoTarefaTimelineProps {
  tarefaId: string;
  maxHeight?: string;
}

export function ProjetoTarefaTimeline({ tarefaId, maxHeight = "500px" }: ProjetoTarefaTimelineProps) {
  const [tab, setTab] = useState<"all" | "comments">("all");
  const [showRawIds, setShowRawIds] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { isAdmin } = useUserRole();

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ["tarefa-timeline-comments", tarefaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("id, conteudo, user_id, created_at")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!data?.length) return [];
      const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
      let profileMap: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      }
      return data.map(c => ({
        id: c.id,
        type: "comment" as const,
        created_at: c.created_at,
        user_nome: profileMap[c.user_id]?.nome || "Usuário",
        user_avatar: profileMap[c.user_id]?.avatar_url || null,
        conteudo: c.conteudo,
      }));
    },
    enabled: !!tarefaId,
  });

  // Fetch activities (resolve also UUIDs referenced in valor_anterior/valor_novo for user-ref types)
  const { data: activitiesData = { items: [], nameById: {} as Record<string, string> } } = useQuery({
    queryKey: ["tarefa-timeline-activities", tarefaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projeto_tarefa_atividades" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!data?.length) return { items: [], nameById: {} };
      const rows = data as any[];
      const allIds = new Set<string>();
      for (const a of rows) {
        if (a.user_id) allIds.add(a.user_id);
        if (USER_REF_TIPOS.has(a.tipo)) {
          if (a.valor_anterior && UUID_RE.test(a.valor_anterior)) allIds.add(a.valor_anterior);
          if (a.valor_novo && UUID_RE.test(a.valor_novo)) allIds.add(a.valor_novo);
        }
      }
      let profileMap: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (allIds.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", [...allIds]);
        if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      }
      const nameById: Record<string, string> = {};
      for (const [id, p] of Object.entries(profileMap)) nameById[id] = p.nome || "Usuário";
      const items = rows.map(a => ({
        id: a.id,
        type: "activity" as const,
        created_at: a.created_at,
        user_nome: profileMap[a.user_id]?.nome || "Sistema",
        user_avatar: profileMap[a.user_id]?.avatar_url || null,
        tipo: a.tipo,
        campo: a.campo,
        valor_anterior: a.valor_anterior,
        valor_novo: a.valor_novo,
        descricao: a.descricao,
      }));
      return { items, nameById };
    },
    enabled: !!tarefaId,
  });

  const activities = activitiesData.items;
  const nameById = activitiesData.nameById;

  const items: TimelineItem[] = useMemo(() => {
    return tab === "comments"
      ? [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : [...comments, ...activities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tab, comments, activities]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** Renderiza valor (UUID → nome quando aplicável). Se isUserRef e não-admin, sempre nome (ou "—"). */
  const renderValor = (raw: string | null | undefined, isUserRef: boolean): string => {
    if (!raw) return "—";
    if (isUserRef && UUID_RE.test(raw)) {
      const nome = nameById[raw];
      if (nome) return nome;
      // sem perfil → não expor UUID a não-admin
      return isAdmin && showRawIds ? raw : "Usuário";
    }
    return raw;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Timeline
        </h3>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRawIds(v => !v)}
                  >
                    {showRawIds ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showRawIds ? "Ocultar IDs" : "Detalhes técnicos"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Mostra IDs internos do sistema (somente admin)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="h-7">
              <TabsTrigger value="all" className="text-[10px] px-2 h-5 gap-1">
                <History className="h-3 w-3" /> Tudo
                <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">{comments.length + activities.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="comments" className="text-[10px] px-2 h-5 gap-1">
                <MessageSquare className="h-3 w-3" /> Comentários
                <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">{comments.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6">
          <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
        </div>
      ) : (
        <TooltipProvider>
          <ScrollArea style={{ maxHeight }}>
            <div className="relative">
              <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border/50" />
              <div className="space-y-3">
                {items.map(item => {
                  if (item.type === "comment") {
                    return (
                      <div key={item.id} className="flex items-start gap-3 text-xs relative pl-1">
                        <Avatar className="h-[26px] w-[26px] flex-shrink-0 z-10 ring-2 ring-background">
                          <AvatarImage src={item.user_avatar || undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                            {item.user_nome?.charAt(0)?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{item.user_nome?.split(" ")[0]}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 border-primary/30 text-primary">
                              <MessageSquare className="h-2.5 w-2.5" /> Comentário
                            </Badge>
                          </div>
                          <p className="text-[11px] text-foreground/80 mt-1 whitespace-pre-wrap bg-muted/50 rounded-md px-2.5 py-1.5 border border-border/30">
                            {item.conteudo}
                          </p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground/70 mt-1 inline-block cursor-default">
                                {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  }

                  // Activity item
                  const config = TIPO_CONFIG[item.tipo || "sistema"] || TIPO_CONFIG.sistema;
                  const firstName = item.user_nome?.split(" ")[0] || "Sistema";
                  const isUserRef = USER_REF_TIPOS.has(item.tipo || "");
                  const hasValues = !!(item.valor_anterior || item.valor_novo);
                  const isExpanded = expandedIds.has(item.id);

                  // Detalhes "técnicos" (diff antigo → novo): para tipos não-usuário, exibimos como antes;
                  // para tipos de usuário, só exibimos quando expandido (info já está em "descricao").
                  // Para criação/descricao_change, nunca exibimos o diff.
                  const canShowDiff =
                    hasValues &&
                    item.tipo !== "criacao" &&
                    item.tipo !== "descricao_change";

                  const showDiffByDefault = canShowDiff && !isUserRef;
                  const showDiffNow = canShowDiff && (showDiffByDefault || isExpanded);

                  // Mostra botão de expandir quando há diff oculto por padrão
                  const showExpandButton = canShowDiff && isUserRef;

                  return (
                    <div key={item.id} className="flex items-start gap-3 text-xs relative pl-1">
                      <div className={cn("h-[26px] w-[26px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-background", config.color)}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground">{firstName}</span>
                          <span className="text-muted-foreground">{item.descricao}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            {config.label}
                          </Badge>
                        </div>
                        {showDiffNow && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] flex-wrap">
                            {item.valor_anterior && (
                              <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive line-through">
                                {renderValor(item.valor_anterior, isUserRef)}
                              </span>
                            )}
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">
                              {renderValor(item.valor_novo, isUserRef)}
                            </span>
                          </div>
                        )}
                        {/* IDs crus, só admin com toggle ativo */}
                        {isExpanded && isUserRef && isAdmin && showRawIds && (
                          <div className="mt-1 text-[10px] text-muted-foreground/60 font-mono break-all">
                            {item.valor_anterior && <div>antigo: {item.valor_anterior}</div>}
                            {item.valor_novo && <div>novo: {item.valor_novo}</div>}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground/70 inline-block cursor-default">
                                {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                            </TooltipContent>
                          </Tooltip>
                          {showExpandButton && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              className="text-[10px] text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-0.5 transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </TooltipProvider>
      )}
    </div>
  );
}
