import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare, Send, Loader2, Reply, X, Check, CheckCheck,
  Lock, Unlock, AtSign, Package, FileText, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Mensagem {
  id: string;
  submissao_id: string;
  usuario_id: string;
  usuario_nome: string;
  conteudo: string;
  tipo: "china" | "brasil";
  ref_tipo: string | null;
  ref_id: string | null;
  ref_label: string | null;
  resposta_a_id: string | null;
  mencoes: { user_id: string; nome: string }[];
  lida_por: string[];
  anexos: any[];
  created_at: string;
}

interface RefOption {
  tipo: "produto" | "checklist" | "documento";
  id: string;
  label: string;
}

interface Props {
  submissaoId: string;
  produtoNome: string;
  tipoRemetente: "china" | "brasil";
  referenciasDisponiveis: RefOption[];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function renderConteudoComMencoes(texto: string) {
  const parts = texto.split(/(@[\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-bold text-primary">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Hoje 今天";
  if (isYesterday(date)) return "Ontem 昨天";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const REF_ICONS: Record<string, React.ReactNode> = {
  produto: <Package className="h-3 w-3" />,
  checklist: <ClipboardList className="h-3 w-3" />,
  documento: <FileText className="h-3 w-3" />,
};

export function ChinaChatPanel({ submissaoId, produtoNome, tipoRemetente, referenciasDisponiveis }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [refSelecionada, setRefSelecionada] = useState<string>("none");
  const [replyingTo, setReplyingTo] = useState<Mensagem | null>(null);
  const [chatStatus, setChatStatus] = useState<string>("aberto");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mencoesSelecionadas, setMencoesSelecionadas] = useState<{ user_id: string; nome: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Load profiles for mentions
  useEffect(() => {
    (async () => {
      const profiles = new Map<string, { id: string; nome: string }>();

      // All approved profiles (China + Brasil teams)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("aprovado", true)
        .not("nome", "is", null);

      for (const u of allProfiles || []) {
        if (u.nome) profiles.set(u.id, { id: u.id, nome: u.nome });
      }

      // Participants of this chat
      const { data: participantes } = await supabase
        .from("china_chat_mensagens" as any)
        .select("usuario_id, usuario_nome")
        .eq("submissao_id", submissaoId);

      for (const p of (participantes || []) as any[]) {
        if (p.usuario_id && p.usuario_nome && !profiles.has(p.usuario_id)) {
          profiles.set(p.usuario_id, { id: p.usuario_id, nome: p.usuario_nome });
        }
      }

      setUsuarios(Array.from(profiles.values()));
    })();
  }, [submissaoId]);

  // Load chat status
  useEffect(() => {
    supabase
      .from("china_produto_submissoes" as any)
      .select("chat_status")
      .eq("id", submissaoId)
      .single()
      .then(({ data }) => {
        if (data) setChatStatus((data as any).chat_status || "aberto");
      });
  }, [submissaoId]);

  const carregarMensagens = useCallback(async () => {
    const { data, error } = await supabase
      .from("china_chat_mensagens" as any)
      .select("*")
      .eq("submissao_id", submissaoId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMensagens((data as any[]).map((m: any) => ({
        ...m,
        mencoes: m.mencoes || [],
        lida_por: m.lida_por || [],
        anexos: m.anexos || [],
      })));
    }
    setLoading(false);
  }, [submissaoId]);

  useEffect(() => { carregarMensagens(); }, [carregarMensagens]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`china-chat-${submissaoId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "china_chat_mensagens",
        filter: `submissao_id=eq.${submissaoId}`,
      }, (payload) => {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === (payload.new as any).id)) return prev;
          const newMsg = payload.new as any;
          return [...prev, { ...newMsg, mencoes: newMsg.mencoes || [], lida_por: newMsg.lida_por || [], anexos: newMsg.anexos || [] }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [submissaoId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens]);

  // Mark messages as read
  useEffect(() => {
    if (!currentUserId || mensagens.length === 0) return;
    const unread = mensagens.filter(
      m => m.usuario_id !== currentUserId && !(m.lida_por || []).includes(currentUserId)
    );
    for (const msg of unread) {
      const newLida = [...(msg.lida_por || []), currentUserId];
      supabase.from("china_chat_mensagens" as any)
        .update({ lida_por: newLida } as any)
        .eq("id", msg.id)
        .then();
    }
  }, [mensagens, currentUserId]);

  const enviarMensagem = async () => {
    if (!texto.trim() || chatStatus === "finalizado") return;
    setEnviando(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const nome = user?.user_metadata?.nome || user?.email || "Usuário";

      // Parse reference
      let ref_tipo: string | null = null;
      let ref_id: string | null = null;
      let ref_label: string | null = null;
      if (refSelecionada !== "none") {
        const ref = referenciasDisponiveis.find(r => `${r.tipo}:${r.id}` === refSelecionada);
        if (ref) {
          ref_tipo = ref.tipo;
          ref_id = ref.id;
          ref_label = ref.label;
        }
      }

      await supabase.from("china_chat_mensagens" as any).insert({
        submissao_id: submissaoId,
        usuario_id: user?.id,
        usuario_nome: nome,
        conteudo: texto.trim(),
        tipo: tipoRemetente,
        ref_tipo,
        ref_id,
        ref_label,
        resposta_a_id: replyingTo?.id || null,
        mencoes: mencoesSelecionadas.length > 0 ? mencoesSelecionadas : [],
      } as any);

      setTexto("");
      setRefSelecionada("none");
      setReplyingTo(null);
      setMencoesSelecionadas([]);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const finalizarChat = async () => {
    await supabase.from("china_produto_submissoes" as any)
      .update({ chat_status: "finalizado" } as any)
      .eq("id", submissaoId);
    setChatStatus("finalizado");
    toast.success("Chat finalizado 聊天已结束");
  };

  const reabrirChat = async () => {
    await supabase.from("china_produto_submissoes" as any)
      .update({ chat_status: "aberto" } as any)
      .eq("id", submissaoId);
    setChatStatus("aberto");
    toast.success("Chat reaberto 聊天已重新开启");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTexto(val);
    const cursorPos = e.target.selectionStart;
    const textBefore = val.substring(0, cursorPos);
    const atMatch = textBefore.match(/@([\wÀ-ÿ]*)$/);
    if (atMatch) {
      setMentionFilter(atMatch[1].toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (user: { id: string; nome: string }) => {
    const cursorPos = textareaRef.current?.selectionStart || texto.length;
    const textBefore = texto.substring(0, cursorPos);
    const textAfter = texto.substring(cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    const newText = textBefore.substring(0, atIdx) + `@${user.nome} ` + textAfter;
    setTexto(newText);
    setMentionOpen(false);
    setMencoesSelecionadas(prev => {
      if (prev.some(m => m.user_id === user.id)) return prev;
      return [...prev, { user_id: user.id, nome: user.nome }];
    });
    textareaRef.current?.focus();
  };

  const filteredUsuarios = useMemo(() => {
    if (!mentionFilter) return usuarios.slice(0, 8);
    return usuarios.filter(u => u.nome.toLowerCase().includes(mentionFilter)).slice(0, 8);
  }, [usuarios, mentionFilter]);

  const getReplyMsg = (id: string | null) => {
    if (!id) return null;
    return mensagens.find((m) => m.id === id) || null;
  };

  const isFinalizado = chatStatus === "finalizado";

  return (
    <Card className="flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Chat 聊天</span>
          <span className="text-xs text-muted-foreground">
            {mensagens.length} mensagen{mensagens.length !== 1 ? "s" : ""}
          </span>
          {isFinalizado && (
            <Badge variant="outline" className="text-[10px] py-0 gap-0.5">
              <Lock className="h-2.5 w-2.5" /> Finalizado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {tipoRemetente === "brasil" && (
            isFinalizado ? (
              <Button variant="ghost" size="sm" onClick={reabrirChat} className="text-[10px] h-6 gap-0.5">
                <Unlock className="h-3 w-3" /> Reabrir 重新开启
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={finalizarChat} className="text-[10px] h-6 gap-0.5 text-destructive hover:text-destructive">
                <Lock className="h-3 w-3" /> Finalizar 结束
              </Button>
            )
          )}
        </div>
      </div>

      {/* Finalized banner */}
      {isFinalizado && (
        <div className="mx-3 mt-2 bg-muted/60 border rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5 shrink-0">
          <Lock className="h-3 w-3" />
          Conversa finalizada. 对话已结束。
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs">还没有消息</p>
          </div>
        ) : (
          mensagens.map((msg, idx) => {
            const isChina = msg.tipo === "china";
            const replyMsg = getReplyMsg(msg.resposta_a_id);
            const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
            const isRead = msg.lida_por && msg.lida_por.length > 0;

            // Date separator
            const msgDateKey = getDateKey(msg.created_at);
            const prevDateKey = prevMsg ? getDateKey(prevMsg.created_at) : null;
            const showDateSep = !prevMsg || msgDateKey !== prevDateKey;

            // Group same sender
            const isSameSender = prevMsg && prevMsg.usuario_id === msg.usuario_id && !showDateSep;

            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground font-medium bg-background px-2 py-0.5 rounded-full border">
                      {getDateLabel(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className={`flex gap-2 group ${isChina ? "" : "flex-row-reverse"} ${isSameSender ? "mt-0.5" : "mt-2"}`}>
                  {/* Avatar */}
                  {!isSameSender ? (
                    <Avatar className="h-7 w-7 shrink-0 mt-1">
                      <AvatarFallback className={`text-[10px] font-semibold ${
                        isChina ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}>
                        {getInitials(msg.usuario_nome)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-7 shrink-0" />
                  )}

                  {/* Bubble */}
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 relative ${
                    isChina
                      ? "bg-red-50 text-red-950 border border-red-200 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800"
                      : "bg-blue-600 text-white"
                  }`}>
                    {/* Reply quote */}
                    {replyMsg && (
                      <div className={`rounded-md px-2 py-1 mb-1.5 text-[11px] border-l-2 ${
                        isChina ? "bg-red-100/50 border-red-300 dark:bg-red-900/30 dark:border-red-600" : "bg-blue-500/40 border-blue-300"
                      }`}>
                        <span className="font-semibold">{replyMsg.usuario_nome}</span>
                        <p className="truncate opacity-80">{replyMsg.conteudo.substring(0, 80)}</p>
                      </div>
                    )}

                    {/* Header */}
                    {!isSameSender && (
                      <div className={`flex items-center gap-2 mb-0.5 ${isChina ? "text-red-600 dark:text-red-300" : "text-blue-100"}`}>
                        <span className="text-xs font-semibold">{msg.usuario_nome}</span>
                        <Badge variant="outline" className={`text-[9px] py-0 px-1 ${
                          isChina ? "border-red-300 text-red-600 dark:border-red-600 dark:text-red-300" : "border-blue-300 text-blue-200"
                        }`}>
                          {isChina ? "China 中国" : "Brasil 巴西"}
                        </Badge>
                        <span className="text-[10px] ml-auto flex items-center gap-0.5">
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                          {!isChina && (
                            isRead ? <CheckCheck className="h-3 w-3 text-blue-200" /> : <Check className="h-3 w-3 text-blue-300/60" />
                          )}
                        </span>
                      </div>
                    )}

                    {/* Time for grouped */}
                    {isSameSender && (
                      <div className={`flex justify-end mb-0.5 ${isChina ? "text-red-400/60" : "text-blue-200/60"}`}>
                        <span className="text-[9px] flex items-center gap-0.5">
                          {format(new Date(msg.created_at), "HH:mm")}
                          {!isChina && (
                            isRead ? <CheckCheck className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />
                          )}
                        </span>
                      </div>
                    )}

                    {/* Reference tag */}
                    {msg.ref_tipo && msg.ref_label && (
                      <Badge
                        variant={isChina ? "outline" : "secondary"}
                        className={`text-[10px] mb-1 py-0 gap-1 ${
                          isChina ? "border-red-300 dark:border-red-600" : "bg-blue-500/30 border-0"
                        }`}
                      >
                        {REF_ICONS[msg.ref_tipo] || <FileText className="h-3 w-3" />}
                        {msg.ref_label}
                      </Badge>
                    )}

                    {/* Content */}
                    <p className="text-sm whitespace-pre-wrap">{renderConteudoComMencoes(msg.conteudo)}</p>

                    {/* Reply action */}
                    {!isFinalizado && (
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className={`absolute -top-2 ${isChina ? "right-0 translate-x-full" : "left-0 -translate-x-full"} opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-full p-1 shadow-sm`}
                        title="Responder 回复"
                      >
                        <Reply className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Input area */}
      {!isFinalizado && (
        <div className="border-t bg-card p-3 space-y-2 shrink-0">
          {/* Reply preview */}
          {replyingTo && (
            <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-3 py-2">
              <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-primary">{replyingTo.usuario_nome}</span>
                <p className="text-xs text-muted-foreground truncate">{replyingTo.conteudo.substring(0, 100)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyingTo(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Reference selector */}
          {referenciasDisponiveis.length > 0 && (
            <Select value={refSelecionada} onValueChange={setRefSelecionada}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Marcar referência (opcional) 标记参考（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem referência 无参考</SelectItem>
                {referenciasDisponiveis.map((ref) => (
                  <SelectItem key={`${ref.tipo}:${ref.id}`} value={`${ref.tipo}:${ref.id}`}>
                    <span className="flex items-center gap-1.5">
                      {REF_ICONS[ref.tipo]}
                      {ref.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Mention badges */}
          {mencoesSelecionadas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mencoesSelecionadas.map(m => (
                <Badge key={m.user_id} variant="secondary" className="text-[10px] gap-1">
                  @{m.nome}
                  <button onClick={() => setMencoesSelecionadas(prev => prev.filter(p => p.user_id !== m.user_id))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Text input + mention popover */}
          <div className="flex gap-2 relative">
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                value={texto}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  tipoRemetente === "china"
                    ? "发送消息... (@ 提及) / Enviar mensagem..."
                    : "Enviar mensagem... (@ para mencionar)"
                }
                className="min-h-[60px] text-sm resize-none pr-8"
                rows={2}
              />
              <button
                type="button"
                className="absolute right-2 bottom-2 text-muted-foreground hover:text-primary"
                onClick={() => {
                  setTexto(prev => prev + "@");
                  setMentionOpen(true);
                  setMentionFilter("");
                  textareaRef.current?.focus();
                }}
                title="Mencionar 提及"
              >
                <AtSign className="h-4 w-4" />
              </button>

              {/* Mention dropdown */}
              {mentionOpen && filteredUsuarios.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredUsuarios.map(u => (
                    <button
                      key={u.id}
                      onClick={() => insertMention(u)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                          {getInitials(u.nome)}
                        </AvatarFallback>
                      </Avatar>
                      {u.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="icon"
              onClick={enviarMensagem}
              disabled={!texto.trim() || enviando}
              className="h-auto"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
