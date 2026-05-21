/**
 * ProjetoChatPanel — painel central do Chat quando o usuário seleciona um
 * projeto. Espelha o BriefingChatPanel:
 *  - Cabeçalho com nome, status e % concluído.
 *  - Abas: Resumo (próximas tarefas), Comentários (chat geral + comentários
 *    de tarefas, com chip "Tarefa · TÍTULO" e botão "Abrir tarefa↗"),
 *    Atividade (resumos diários / mensagens de sistema).
 *  - Composer no rodapé envia mensagem no chat geral do projeto.
 *
 * Edição das tarefas continua no /dashboard/projetos/<id>; daqui só
 * leitura + comentário geral + deep-link para a tarefa de origem.
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  MessageSquare,
  Sparkles,
  Send,
  AtSign,
  Briefcase,
  ListTodo,
  Paperclip,
  FolderLock,
} from "lucide-react";
import { ProjetoCofreUploadDialog } from "@/components/projetos/cofre/ProjetoCofreUploadDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionTextarea } from "@/components/briefings/MentionTextarea";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoChat, type ProjetoChatMessage } from "@/hooks/useProjetoChat";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import {
  useProjetoComentariosAgg,
  type ProjetoComentarioAgg,
} from "@/hooks/chat/useProjetoComentariosAgg";
import {
  marcarProjetoLido,
  useProjetosChat,
} from "@/hooks/chat/useProjetosChat";
import { initials, formatRelativo } from "./utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveMentionsFromText } from "@/lib/briefings/resolveMentions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

interface Props {
  projetoId: string;
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

const STATUS_TONE: Record<string, string> = {
  ativo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pausado: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  concluido: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
  arquivado: "bg-muted text-muted-foreground border-border",
};

export function ProjetoChatPanel({ projetoId }: Props) {
  const navigate = (url: string) => {
    window.location.assign(url);
  };
  const { user } = useAuth();
  const { messages, sendMessage } = useProjetoChat(projetoId);
  const { membros } = useProjetoMembros(projetoId);
  const { data: comentarios = [] } = useProjetoComentariosAgg(projetoId);
  const { data: projetosChat = [] } = useProjetosChat();

  const projeto = useMemo(
    () => projetosChat.find((p) => p.id === projetoId) ?? null,
    [projetosChat, projetoId],
  );

  // Tarefas do projeto — para Resumo e contagem de %.
  const { data: tarefas = [] } = useQuery({
    queryKey: ["projeto-tarefas-chatpanel", projetoId],
    enabled: !!projetoId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projeto_tarefas")
        .select("id, titulo, codigo, status, data_prazo")
        .eq("projeto_id", projetoId)
        .order("data_prazo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        titulo: string;
        codigo: string | null;
        status: string;
        data_prazo: string | null;
      }>;
    },
  });

  const [tab, setTab] = useState<"resumo" | "comentarios" | "ia">("comentarios");
  const [filtroComent, setFiltroComent] = useState<"todos" | "mencionam">("todos");
  const [novoComentario, setNovoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Marca como lido ao abrir / trocar de projeto.
  useEffect(() => {
    if (projetoId) {
      marcarProjetoLido(projetoId).catch(() => {
        /* silencioso */
      });
    }
  }, [projetoId]);

  const goProjeto = (params?: { tarefa?: string; comentario?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tarefa) qs.set("tarefa", params.tarefa);
    if (params?.comentario) qs.set("comentario", params.comentario);
    const url = `/dashboard/projetos/${projetoId}${qs.toString() ? `?${qs.toString()}` : ""}`;
    navigate(url);
  };

  const tarefasConcluidas = tarefas.filter((t) => t.status === "concluida").length;
  const completude = tarefas.length
    ? Math.round((tarefasConcluidas / tarefas.length) * 100)
    : 0;

  const proximasTarefas = useMemo(
    () =>
      tarefas
        .filter((t) => t.status !== "concluida" && t.status !== "cancelada")
        .slice(0, 12),
    [tarefas],
  );

  const comentariosFiltrados = useMemo(() => {
    if (filtroComent === "mencionam") {
      return comentarios.filter(
        (c) => user?.id && Array.isArray(c.mentions) && c.mentions.includes(user.id),
      );
    }
    return comentarios;
  }, [comentarios, filtroComent, user?.id]);

  const mensagensAtividade = useMemo(
    () =>
      messages
        .filter((m) => m.tipo === "resumo_diario" || m.tipo === "sistema")
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [messages],
  );

  const totalNaoLidos = projeto?.naoLidos ?? 0;

  const enviarComentario = async () => {
    const t = novoComentario.trim();
    if (!t || !projetoId) return;
    setEnviando(true);
    try {
      const mentionMembers = (membros ?? []).map((m) => ({
        user_id: m.user_id,
        nome: m.profile?.nome ?? null,
      }));
      const mentions = resolveMentionsFromText(t, mentionMembers);
      await sendMessage.mutateAsync({ conteudo: t, mentions });
      setNovoComentario("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar a mensagem");
    } finally {
      setEnviando(false);
    }
  };

  const nomeProjeto = projeto?.nome ?? "Projeto";
  const corProjeto = projeto?.cor ?? "#6366f1";

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 py-3.5 border-b border-border flex items-start gap-3 bg-card">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1"
          style={{
            backgroundColor: `${corProjeto}1A`,
            // ring color uses currentColor of icon below
            boxShadow: `inset 0 0 0 1px ${corProjeto}40`,
          }}
        >
          <Briefcase className="h-5 w-5" style={{ color: corProjeto }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold tracking-tight truncate">
              {nomeProjeto}
            </h2>
            {projeto?.status && (
              <Badge
                variant="outline"
                className={cn("text-[10px]", STATUS_TONE[projeto.status] ?? "")}
              >
                {STATUS_LABEL[projeto.status] ?? projeto.status}
              </Badge>
            )}
            {totalNaoLidos > 0 && (
              <Badge className="text-[10px] h-4 px-1 bg-emerald-600 hover:bg-emerald-600">
                {totalNaoLidos} novo(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 max-w-[220px] h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all rounded-full"
                style={{
                  width: `${completude}%`,
                  backgroundColor: corProjeto,
                }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
              {completude}% — {tarefasConcluidas}/{tarefas.length} tarefas
            </span>
            {membros.length > 0 && (
              <div className="flex -space-x-2">
                {membros.slice(0, 4).map((m) => (
                  <Avatar key={m.id} className="h-6 w-6 ring-2 ring-card">
                    {m.profile?.avatar_url && (
                      <AvatarImage src={m.profile.avatar_url} alt={m.profile?.nome ?? ""} />
                    )}
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {initials(m.profile?.nome, null)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {membros.length > 4 && (
                  <div className="h-6 w-6 rounded-full bg-muted text-[10px] text-muted-foreground flex items-center justify-center ring-2 ring-card">
                    +{membros.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => goProjeto()}
          className="gap-1.5 shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir projeto
        </Button>
      </header>

      {/* Abas */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as any)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 pt-2 border-b border-border bg-card">
          <TabsList className="h-9 bg-muted/40 p-1">
            <TabsTrigger value="resumo" className="text-xs gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Resumo
              {proximasTarefas.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                  {proximasTarefas.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="comentarios" className="text-xs gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Comentários
              {comentarios.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                  {comentarios.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="ia" className="text-xs gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Atividade
              {mensagensAtividade.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                  {mensagensAtividade.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumo" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="px-4 py-3 space-y-2">
              {proximasTarefas.length === 0 && (
                <EmptyState
                  icon={<ListTodo className="h-8 w-8" />}
                  title="Nenhuma tarefa pendente"
                  hint="Abra o projeto para criar novas tarefas."
                />
              )}
              {proximasTarefas.map((t) => (
                <button
                  key={t.id}
                  onClick={() => goProjeto({ tarefa: t.id })}
                  className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.codigo && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {t.codigo}
                        </span>
                      )}
                      <span className="text-sm truncate">{t.titulo}</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.status}
                    </Badge>
                    {t.data_prazo && (
                      <span className="text-[10px] text-muted-foreground">
                        Prazo:{" "}
                        {format(parseLocalDate(t.data_prazo), "dd MMM", {
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="comentarios" className="flex-1 min-h-0 m-0">
          <div className="px-4 pt-2 pb-1 flex items-center gap-1">
            {(
              [
                { v: "todos", l: "Todos" },
                { v: "mencionam", l: "Me marcaram" },
              ] as const
            ).map((f) => (
              <button
                key={f.v}
                onClick={() => setFiltroComent(f.v)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  filtroComent === f.v
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/60",
                )}
              >
                {f.l}
              </button>
            ))}
          </div>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="px-4 py-2 space-y-2">
              {comentariosFiltrados.length === 0 && (
                <EmptyState
                  icon={<MessageSquare className="h-8 w-8" />}
                  title="Nenhum comentário ainda"
                  hint="Use o composer abaixo para mandar uma mensagem no chat do projeto."
                />
              )}
              {comentariosFiltrados.map((c) => (
                <ComentarioCard
                  key={c.id}
                  c={c}
                  isMe={c.user_id === user?.id}
                  mencionaMe={
                    Array.isArray(c.mentions) &&
                    !!user?.id &&
                    c.mentions.includes(user.id)
                  }
                  onOpen={() => {
                    if (c.origem === "tarefa" && c.tarefaRef) {
                      // Deep-link reutiliza padrão de notificações.
                      goProjeto({
                        tarefa: c.tarefaRef.id,
                        comentario: c.id.replace(/^tc-/, ""),
                      });
                    } else {
                      goProjeto();
                    }
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ia" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="px-4 py-3 space-y-2">
              {mensagensAtividade.length === 0 && (
                <EmptyState
                  icon={<Sparkles className="h-8 w-8" />}
                  title="Sem atividade automática"
                  hint="Resumos diários e mensagens de sistema aparecem aqui."
                />
              )}
              {mensagensAtividade.map((m) => (
                <AtividadeCard key={m.id} m={m} onOpen={() => goProjeto()} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Composer mensagem do chat geral */}
      <div className="border-t border-border bg-card p-3">
        <div className="rounded-xl border border-border bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-colors p-2">
          <MentionTextarea
            value={novoComentario}
            onChange={setNovoComentario}
            onSubmitShortcut={enviarComentario}
            members={(membros ?? []).map((m) => ({
              user_id: m.user_id,
              nome: m.profile?.nome ?? null,
              avatar_url: m.profile?.avatar_url ?? null,
            }))}
            placeholder="Mensagem no chat do projeto… digite @ para marcar alguém"
            rows={2}
            className="resize-none border-0 focus-visible:ring-0 shadow-none px-1.5 py-1 min-h-0 text-sm"
          />
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground px-1.5 flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Digite @ para mencionar um membro
            </span>
            <Button
              size="sm"
              disabled={enviando || !novoComentario.trim()}
              onClick={enviarComentario}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 gap-2">
      <div className="text-muted-foreground/40">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground max-w-[280px]">{hint}</p>}
    </div>
  );
}

function ComentarioCard({
  c,
  isMe,
  mencionaMe,
  onOpen,
}: {
  c: ProjetoComentarioAgg;
  isMe: boolean;
  mencionaMe: boolean;
  onOpen: () => void;
}) {
  const ehTarefa = c.origem === "tarefa" && !!c.tarefaRef;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-lg border bg-card hover:bg-muted/40 transition-colors p-3 space-y-1.5 shadow-sm",
        "border-l-2",
        ehTarefa ? "border-l-primary/40" : "border-l-muted-foreground/30",
        mencionaMe && "border-l-amber-500 bg-amber-500/[0.04]",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Avatar className={cn("h-5 w-5", mencionaMe && "ring-2 ring-amber-500/40")}>
          {c.autor_avatar && <AvatarImage src={c.autor_avatar} alt={c.autor_nome ?? ""} />}
          <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
            {initials(c.autor_nome, null)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium">
          {isMe ? "Você" : c.autor_nome ?? "Membro"}
        </span>
        {ehTarefa ? (
          <Badge variant="outline" className="text-[10px] gap-1">
            <ListTodo className="h-2.5 w-2.5" />
            Tarefa{c.tarefaRef?.codigo ? ` · ${c.tarefaRef.codigo}` : ""}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Chat geral
          </Badge>
        )}
        {mencionaMe && (
          <Badge className="text-[10px] h-4 px-1 bg-amber-500 text-white hover:bg-amber-500 gap-1">
            <AtSign className="h-2.5 w-2.5" /> mencionou você
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatRelativo(c.created_at)}
        </span>
      </div>
      {ehTarefa && c.tarefaRef && (
        <p className="text-[11px] text-muted-foreground truncate">
          {c.tarefaRef.titulo}
        </p>
      )}
      <p className="text-sm whitespace-pre-wrap line-clamp-4">{c.conteudo}</p>
      <div className="flex items-center justify-end">
        <span className="text-[10px] text-primary inline-flex items-center gap-1">
          {ehTarefa ? "Abrir tarefa" : "Abrir projeto"}{" "}
          <ExternalLink className="h-2.5 w-2.5" />
        </span>
      </div>
    </button>
  );
}

function AtividadeCard({
  m,
  onOpen,
}: {
  m: ProjetoChatMessage;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors p-3"
    >
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {m.tipo === "resumo_diario" ? "Resumo do dia" : "Sistema"}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatRelativo(m.created_at)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap line-clamp-5">{m.conteudo}</p>
    </button>
  );
}
