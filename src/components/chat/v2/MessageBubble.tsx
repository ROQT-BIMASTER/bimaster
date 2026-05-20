import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreVertical, Reply, Smile, Pin, Pencil, Trash2, Star, Copy, CornerUpRight, Check, CheckCheck, Languages, Loader2, ListPlus, ExternalLink, Info } from "lucide-react";
import { CriarTarefaDoChatDialog } from "./CriarTarefaDoChatDialog";
import { MessageInfoDialog } from "./MessageInfoDialog";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ChatMensagem } from "@/hooks/chat/types";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { initials, formatHora } from "./utils";
import { AnexoView } from "./AnexoView";
import { ForwardMessageDialog } from "./ForwardMessageDialog";
import { TaskMentionCard } from "./TaskMentionCard";
import { AprovacaoCard } from "./AprovacaoCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const IDIOMAS = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "cn", label: "中文", flag: "🇨🇳" },
] as const;

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];

interface Props {
  m: ChatMensagem;
  uid: string;
  isGrupo: boolean;
  onReply: (m: ChatMensagem) => void;
  onForward?: (m: ChatMensagem) => void;
  participantesCount: number;
}

export function MessageBubble({ m, uid, isGrupo, onReply, participantesCount }: Props) {
  // Mensagens da Sofia (metadata.sofia=true) são renderizadas como vindas dela,
  // NÃO do remetente_id (que tecnicamente é o user que invocou /sofia ou /resumir).
  const isSofia = (m.metadata as any)?.sofia === true;
  const mine = !isSofia && m.remetente_id === uid;
  const actions = useChatActions();
  const [editing, setEditing] = useState(false);
  const [editTxt, setEditTxt] = useState(m.conteudo);
  const [traducao, setTraducao] = useState<{ idioma: string; texto: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [criarTarefaOpen, setCriarTarefaOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const tarefaVinculada = (m.metadata as any)?.tarefa_id as string | undefined;
  const tarefaTitulo = (m.metadata as any)?.tarefa_titulo as string | undefined;
  const tarefaProjetoId = (m.metadata as any)?.projeto_id as string | undefined;

  const traduzir = async (idioma: string) => {
    if (!m.conteudo || m.conteudo.trim().length < 2) {
      toast.error("Mensagem sem texto para traduzir");
      return;
    }
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-traducao", {
        body: { mensagem_id: m.id, idioma },
      });
      if (error) throw error;
      const texto = (data as any)?.texto as string | undefined;
      if (!texto) throw new Error("Resposta vazia");
      setTraducao({ idioma, texto });
    } catch (e: any) {
      toast.error("Erro ao traduzir: " + (e?.message ?? ""));
    } finally {
      setTranslating(false);
    }
  };

  const reacoesAgrupadas = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    (m.reacoes ?? []).forEach((r) => {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count++;
      if (r.user_id === uid) cur.mine = true;
      map.set(r.emoji, cur);
    });
    return Array.from(map.entries());
  }, [m.reacoes, uid]);

  // Status estilo WhatsApp:
  //  - sem leituras de outros => 1 check (enviada)
  //  - 1+ leitura de outro, mas nem todos no grupo => 2 checks cinza (entregue/lida parcial)
  //  - todos os outros leram => 2 checks azuis (lida)
  const totalLeituras = (m.leituras ?? []).filter((l) => l.user_id !== uid).length;
  const necessarias = isGrupo ? Math.max(0, participantesCount - 1) : 1;
  const lidaPorTodos = necessarias > 0 && totalLeituras >= necessarias;
  const lidaPorAlguem = totalLeituras > 0 && !lidaPorTodos;

  if (m.excluida_para_todos) {
    return (
      <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
        <div className="max-w-[70%] px-3 py-2 rounded-2xl bg-muted/60 text-xs italic text-muted-foreground">
          Mensagem apagada
        </div>
      </div>
    );
  }

  // Mensagem é um pedido de aprovação inline — renderiza card especial
  // em vez do balão normal. metadata.aprovacao_id é definido pela RPC
  // rpc_chat_aprovacao_criar.
  const aprovacaoId = (m.metadata as any)?.aprovacao_id as string | undefined;
  if (aprovacaoId) {
    return (
      <div className={cn("flex w-full gap-2", mine ? "justify-end" : "justify-start")}>
        <div className="max-w-[88%] md:max-w-[520px] w-full">
          <AprovacaoCard aprovacaoId={aprovacaoId} viewerUid={uid} mine={mine} />
          <p className={cn("text-[10px] mt-1", mine ? "text-right text-muted-foreground" : "text-muted-foreground")}>
            {formatHora(m.created_at)}
          </p>
        </div>
      </div>
    );
  }

  const copiar = () => { navigator.clipboard.writeText(m.conteudo); toast.success("Copiado"); };

  const salvarEdicao = async () => {
    const novo = editTxt.trim();
    if (!novo || novo === m.conteudo) { setEditing(false); return; }
    await actions.editMessage.mutateAsync({ id: m.id, conversaId: m.conversa_id, conteudo: novo });
    setEditing(false);
  };

  return (
    <div className={cn("group flex w-full gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <Avatar className={cn("h-7 w-7 mt-auto shrink-0", isSofia && "ring-2 ring-violet-500/40")}>
          {isSofia ? (
            <AvatarFallback className="bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px]">
              <Languages className="h-3.5 w-3.5" aria-label="Sofia" />
            </AvatarFallback>
          ) : (
            <>
              <AvatarImage src={m.remetente?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]">{initials(m.remetente?.nome, m.remetente?.email)}</AvatarFallback>
            </>
          )}
        </Avatar>
      )}
      <div className={cn("max-w-[72%] md:max-w-[640px] flex flex-col", mine ? "items-end" : "items-start")}>
        {/* Nome do remetente aparece em CADA mensagem não-própria, em DMs e
            em grupos (parecido com o Teams; WhatsApp clássico mostra só em
            grupo, mas o usuário pediu nome explícito em qualquer caso).
            Mensagens da Sofia usam nome fixo e cor violeta. */}
        {!mine && (
          <span className={cn(
            "text-[11px] font-medium px-3 mb-0.5",
            isSofia ? "text-violet-600 dark:text-violet-400" : "text-primary",
          )}>
            {isSofia ? "Sofia" : (m.remetente?.nome ?? m.remetente?.email ?? "Usuário")}
          </span>
        )}
        <div className={cn(
          "relative px-3 py-2 rounded-2xl shadow-sm",
          m.tipo === "urgente" && "ring-2 ring-destructive ring-offset-1 ring-offset-background",
          isSofia
            ? "bg-violet-500/10 border border-violet-500/30 rounded-bl-sm text-foreground"
            : mine
              ? "bg-emerald-600 text-white rounded-br-sm"
              : "bg-card border border-border rounded-bl-sm",
        )}>
          {m.tipo === "urgente" && (
            <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Urgente
              {(m.metadata as any)?.motivo && <span className="font-normal normal-case opacity-80">• {(m.metadata as any).motivo}</span>}
            </div>
          )}
          {m.responde_a && (
            <div className={cn(
              "border-l-2 pl-2 mb-1.5 text-xs opacity-80 max-w-full",
              mine ? "border-white/60" : "border-primary",
            )}>
              {/* Quem mandou a mensagem original — estilo WhatsApp */}
              <div className={cn(
                "font-semibold truncate",
                mine ? "text-white/90" : "text-primary",
              )}>
                {m.responde_a.remetente?.nome
                  ?? m.responde_a.remetente?.email
                  ?? (m.responde_a.remetente_id === uid ? "Você" : "Usuário")}
              </div>
              <div className="truncate">
                {m.responde_a.conteudo || (m.responde_a.tipo === "imagem" ? "📷 Foto" : "Anexo")}
              </div>
            </div>
          )}

          {(m.anexos ?? []).length > 0 && (
            <div className="space-y-1.5 mb-1">
              {(m.anexos ?? []).map((a) => <AnexoView key={a.id} anexo={a} mine={mine} />)}
            </div>
          )}

          {/* Cards de tarefas mencionadas via /tarefa — lidos do metadata */}
          {(() => {
            const tarefas = (m.metadata as any)?.tarefas;
            if (!Array.isArray(tarefas) || tarefas.length === 0) return null;
            return (
              <div className="space-y-1.5 mb-1">
                {tarefas.map((t: { id: string }) => (
                  <TaskMentionCard key={t.id} tarefaId={t.id} mine={mine} />
                ))}
              </div>
            );
          })()}

          {editing ? (
            <div className="space-y-1.5 min-w-[220px]">
              <Textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} rows={2} className="bg-background text-foreground" />
              <div className="flex gap-1.5 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" onClick={salvarEdicao}>Salvar</Button>
              </div>
            </div>
          ) : m.conteudo && (
            <p className="text-sm whitespace-pre-wrap break-words leading-snug">{m.conteudo}</p>
          )}

          {/* Bloco de tradução — só aparece após o usuário clicar em Traduzir.
              Cache no banco garante que mesma mensagem+idioma não recompila IA. */}
          {(traducao || translating) && (
            <div className={cn(
              "mt-2 pt-2 border-t text-sm whitespace-pre-wrap break-words leading-snug",
              mine ? "border-white/30 text-white/95" : "border-border text-foreground/95",
            )}>
              <div className={cn("flex items-center justify-between mb-1 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                <span className="flex items-center gap-1">
                  {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                  {translating
                    ? "Traduzindo..."
                    : `Traduzido (${IDIOMAS.find((i) => i.code === traducao?.idioma)?.flag ?? ""} ${traducao?.idioma.toUpperCase() ?? ""})`}
                </span>
                {traducao && !translating && (
                  <button
                    onClick={() => setTraducao(null)}
                    className="underline opacity-80 hover:opacity-100"
                  >
                    Ocultar
                  </button>
                )}
              </div>
              {traducao?.texto}
            </div>
          )}

          {m.visibilidade === "privada_suporte" && (
            <div className={cn(
              "mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
              mine
                ? "bg-white/15 text-white/90 border-white/20"
                : "bg-primary/10 text-primary border-primary/20",
            )} title="Conversa privada de suporte — apenas você e a equipe Ruby Rose podem ver">
              <Info className="h-2.5 w-2.5" />
              Privado · só você e o suporte
            </div>
          )}
          <div className={cn("flex items-center gap-1 justify-end mt-0.5 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>

            {m.editada_em && (
              <span title={`Editada em ${new Date(m.editada_em).toLocaleString("pt-BR")}`}>
                editada
              </span>
            )}
            {m.fixada_em && <Pin className="h-2.5 w-2.5" />}
            {/* Tooltip nativo (title) com data completa — hover mostra dd/MM/yyyy HH:mm */}
            <span title={new Date(m.created_at).toLocaleString("pt-BR")}>
              {formatHora(m.created_at)}
            </span>
            {mine && (
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                title="Dados da mensagem"
                className="inline-flex items-center hover:opacity-100 opacity-90"
                aria-label="Dados da mensagem"
              >
                {lidaPorTodos
                  ? <CheckCheck className="h-3 w-3 text-sky-300" />
                  : lidaPorAlguem
                    ? <CheckCheck className="h-3 w-3" />
                    : <Check className="h-3 w-3" />}
              </button>
            )}
          </div>

          <div className={cn(
            "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background border border-border rounded-full px-1 py-0.5 shadow-sm",
            mine ? "right-2" : "left-2",
          )}>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6"><Smile className="h-3.5 w-3.5" /></Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-auto p-1 flex gap-0.5">
                {REACTION_SET.map((e) => (
                  <button
                    key={e}
                    onClick={() => actions.toggleReaction.mutate({ id: m.id, conversaId: m.conversa_id, emoji: e })}
                    className="h-8 w-8 rounded hover:bg-muted text-lg leading-none"
                  >{e}</button>
                ))}
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onReply(m)}>
              <Reply className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6"><MoreVertical className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={mine ? "end" : "start"}>
                <DropdownMenuItem onClick={() => onReply(m)}><Reply className="h-4 w-4 mr-2" /> Responder</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => setForwardOpen(true), 0)}>
                  <CornerUpRight className="h-4 w-4 mr-2" /> Encaminhar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copiar}><Copy className="h-4 w-4 mr-2" /> Copiar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => setCriarTarefaOpen(true), 0)}>
                  <ListPlus className="h-4 w-4 mr-2" /> Criar tarefa no projeto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.toggleFavorita.mutate({ id: m.id, conversaId: m.conversa_id, favorita: !!m.favorita })}>
                  <Star className="h-4 w-4 mr-2" /> {m.favorita ? "Remover favorito" : "Favoritar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.togglePin.mutate({ id: m.id, conversaId: m.conversa_id, fixar: !m.fixada_em })}>
                  <Pin className="h-4 w-4 mr-2" /> {m.fixada_em ? "Desafixar" : "Fixar"}
                </DropdownMenuItem>
                {m.conteudo && m.conteudo.trim().length >= 2 && (
                  <>
                    <DropdownMenuSeparator />
                    {IDIOMAS.map((i) => (
                      <DropdownMenuItem
                        key={i.code}
                        onClick={() => traduzir(i.code)}
                        disabled={translating}
                      >
                        <Languages className="h-4 w-4 mr-2" /> Traduzir para {i.flag} {i.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {mine && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setTimeout(() => setInfoOpen(true), 0)}>
                      <Info className="h-4 w-4 mr-2" /> Dados da mensagem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setEditTxt(m.conteudo); setEditing(true); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => actions.deleteMessage.mutate({ id: m.id, conversaId: m.conversa_id, paraTodos: true })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Apagar para todos
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => actions.deleteMessage.mutate({ id: m.id, conversaId: m.conversa_id, paraTodos: false })}>
                  <Trash2 className="h-4 w-4 mr-2" /> Apagar para mim
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {reacoesAgrupadas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {reacoesAgrupadas.map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => actions.toggleReaction.mutate({ id: m.id, conversaId: m.conversa_id, emoji })}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full border bg-card hover:bg-muted",
                  info.mine ? "border-primary text-primary" : "border-border",
                )}
              >
                {emoji} {info.count}
              </button>
            ))}
          </div>
        )}
        {tarefaVinculada && (
          <Link
            to={`/dashboard/projetos/${tarefaProjetoId}?tarefa=${tarefaVinculada}`}
            className="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          >
            <ListPlus className="h-3 w-3" />
            Tarefa vinculada{tarefaTitulo ? `: ${tarefaTitulo.slice(0, 40)}` : ""}
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </Link>
        )}
      </div>
      <ForwardMessageDialog open={forwardOpen} onOpenChange={setForwardOpen} m={m} />
      <CriarTarefaDoChatDialog open={criarTarefaOpen} onOpenChange={setCriarTarefaOpen} mensagem={m} />
      {mine && <MessageInfoDialog open={infoOpen} onOpenChange={setInfoOpen} mensagem={m} uid={uid} />}
    </div>
  );
}
