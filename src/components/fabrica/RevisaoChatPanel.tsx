import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { MessageSquare, Send, Loader2, Reply, X, Check, CheckCheck, Lock, Unlock, AtSign, Paperclip, FileText, Download, Shield, FolderOpen } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { DocumentosTab } from "@/components/fabrica/DocumentosTab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { uploadFile, getSignedUrl } from "@/lib/utils/storage-helper";

interface Mensagem {
  id: string;
  revisao_id: string;
  usuario_id: string | null;
  usuario_nome: string;
  conteudo: string;
  tipo: "usuario" | "diretoria";
  insumo_id: string | null;
  created_at: string;
  resposta_a_id: string | null;
  mencoes: { user_id: string; nome: string }[];
  lida_por: string[];
  anexos: { nome: string; path: string; tipo: string; enviado_para_cofre?: boolean }[];
}

interface InsumoRef {
  id: string;
  nome: string;
  codigo: string;
}

interface Props {
  revisaoId: string;
  configId?: string;
  insumos?: InsumoRef[];
  tipoRemetente?: "usuario" | "diretoria";
  insumosComApontamento?: Set<string>;
  onNavigateToInsumo?: (insumoId: string) => void;
  produtoId?: string;
}

interface MensagemComVersao extends Mensagem {
  versao?: number;
}

interface PerfilUsuario {
  id: string;
  nome: string;
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

export function RevisaoChatPanel({ revisaoId, configId, insumos = [], tipoRemetente = "usuario", insumosComApontamento = new Set(), onNavigateToInsumo, produtoId }: Props) {
  const [mensagens, setMensagens] = useState<MensagemComVersao[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [insumoSelecionado, setInsumoSelecionado] = useState<string>("none");
  const [replyingTo, setReplyingTo] = useState<MensagemComVersao | null>(null);
  const [chatStatus, setChatStatus] = useState<string>("aberto");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mencoesSelecionadas, setMencoesSelecionadas] = useState<{ user_id: string; nome: string }[]>([]);
  const [anexosPendentes, setAnexosPendentes] = useState<File[]>([]);
  const [uploadingAnexos, setUploadingAnexos] = useState(false);
  const [enviarParaCofre, setEnviarParaCofre] = useState(false);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Load profiles for mentions
  useEffect(() => {
    supabase.from("profiles").select("id, nome").eq("aprovado", true).then(({ data }) => {
      if (data) setUsuarios(data.filter((p: any) => p.nome) as PerfilUsuario[]);
    });
  }, []);

  // Load chat status
  useEffect(() => {
    supabase
      .from("fabrica_ficha_custo_revisoes")
      .select("chat_status")
      .eq("id", revisaoId)
      .single()
      .then(({ data }) => {
        if (data) setChatStatus((data as any).chat_status || "aberto");
      });
  }, [revisaoId]);

  const carregarMensagens = useCallback(async () => {
    if (configId) {
      const { data: revisoes } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("id, versao")
        .eq("config_id", configId)
        .order("versao", { ascending: true });

      if (revisoes && revisoes.length > 0) {
        const revisaoIds = revisoes.map((r: any) => r.id);
        const versaoMap = new Map(revisoes.map((r: any) => [r.id, r.versao]));

        const { data, error } = await supabase
          .from("fabrica_revisao_mensagens" as any)
          .select("*")
          .in("revisao_id", revisaoIds)
          .order("created_at", { ascending: true });

        if (!error && data) {
          setMensagens((data as any[]).map((m: any) => ({
            ...m,
            versao: versaoMap.get(m.revisao_id) || 1,
            mencoes: m.mencoes || [],
            lida_por: m.lida_por || [],
            anexos: m.anexos || [],
          })));
        }
      }
    } else {
      const { data, error } = await supabase
        .from("fabrica_revisao_mensagens" as any)
        .select("*")
        .eq("revisao_id", revisaoId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMensagens((data as any[]).map((m: any) => ({
          ...m,
          mencoes: m.mencoes || [],
          lida_por: m.lida_por || [],
          anexos: m.anexos || [],
        })));
      }
    }
    setLoading(false);
  }, [revisaoId, configId]);

  useEffect(() => { carregarMensagens(); }, [carregarMensagens]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`revisao-chat-${revisaoId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "fabrica_revisao_mensagens",
        filter: `revisao_id=eq.${revisaoId}`,
      }, (payload) => {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === (payload.new as any).id)) return prev;
          const newMsg = payload.new as any;
          return [...prev, { ...newMsg, mencoes: newMsg.mencoes || [], lida_por: newMsg.lida_por || [], anexos: newMsg.anexos || [] }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [revisaoId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens]);

  const enviarMensagem = async () => {
    if ((!texto.trim() && anexosPendentes.length === 0) || chatStatus === "finalizado") return;
    setEnviando(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const nome = user?.user_metadata?.nome || user?.email || "Usuário";

      // Upload attachments
      let anexosMeta: { nome: string; path: string; tipo: string; enviado_para_cofre?: boolean }[] = [];
      if (anexosPendentes.length > 0) {
        setUploadingAnexos(true);
        for (const file of anexosPendentes) {
          const ts = Date.now();
          const filePath = `${revisaoId}/${ts}_${file.name}`;
          const { path, error } = await uploadFile("fabrica-revisao-docs", filePath, file);
          if (error) throw error;
          anexosMeta.push({ nome: file.name, path, tipo: file.type, enviado_para_cofre: enviarParaCofre || undefined });
        }
        setUploadingAnexos(false);
      }

      const { data: msgData } = await supabase.from("fabrica_revisao_mensagens" as any).insert({
        revisao_id: revisaoId,
        usuario_id: user?.id,
        usuario_nome: nome,
        conteudo: texto.trim() || (anexosMeta.length > 0 ? `📎 ${anexosMeta.length} arquivo(s) anexado(s)` : ""),
        tipo: tipoRemetente,
        insumo_id: insumoSelecionado !== "none" ? insumoSelecionado : null,
        resposta_a_id: replyingTo?.id || null,
        mencoes: mencoesSelecionadas.length > 0 ? mencoesSelecionadas : [],
        anexos: anexosMeta,
      } as any).select().single();

      // Register documents in fabrica_revisao_documentos only if user opted to send to vault
      if (enviarParaCofre && anexosMeta.length > 0 && msgData) {
        const docRows = anexosMeta.map(a => ({
          revisao_id: revisaoId,
          produto_id: produtoId || revisaoId,
          mensagem_id: (msgData as any).id,
          nome_arquivo: a.nome,
          arquivo_path: a.path,
          tipo_arquivo: a.tipo,
          tamanho: anexosPendentes.find(f => f.name === a.nome)?.size || 0,
          categoria: "geral",
          status: "ativo",
          enviado_por: user?.id,
          enviado_por_nome: nome,
        }));
        await supabase.from("fabrica_revisao_documentos" as any).insert(docRows as any);
      }

      setTexto("");
      setInsumoSelecionado("none");
      setReplyingTo(null);
      setMencoesSelecionadas([]);
      setAnexosPendentes([]);
      setEnviarParaCofre(false);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setEnviando(false);
      setUploadingAnexos(false);
    }
  };

  const finalizarChat = async () => {
    try {
      await supabase.from("fabrica_ficha_custo_revisoes")
        .update({
          chat_status: "finalizado",
          chat_finalizado_por: currentUserId,
          chat_finalizado_em: new Date().toISOString(),
        } as any)
        .eq("id", revisaoId);
      setChatStatus("finalizado");
      toast.success("Conversa finalizada.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const reabrirChat = async () => {
    try {
      await supabase.from("fabrica_ficha_custo_revisoes")
        .update({
          chat_status: "aberto",
          chat_finalizado_por: null,
          chat_finalizado_em: null,
        } as any)
        .eq("id", revisaoId);
      setChatStatus("aberto");
      toast.success("Conversa reaberta.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const getInsumoNome = (insumoId: string | null) => {
    if (!insumoId) return null;
    const insumo = insumos.find((i) => i.id === insumoId);
    return insumo ? `${insumo.codigo} - ${insumo.nome}` : null;
  };

  const getReplyMsg = (id: string | null) => {
    if (!id) return null;
    return mensagens.find((m) => m.id === id) || null;
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

    // Detect @ mention trigger
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

  const insertMention = (user: PerfilUsuario) => {
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

  const isFinalizado = chatStatus === "finalizado";

  return (
    <ResizablePanelGroup direction="horizontal" className="rounded-xl border border-blue-200 bg-blue-50/30">
      <ResizablePanel defaultSize={showDocPanel ? 65 : 100} minSize={50}>
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            Comunicação — Revisão
            {mensagens.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {mensagens.length} mensagen{mensagens.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {isFinalizado && (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <Lock className="h-3 w-3" /> Finalizada
              </Badge>
            )}
          </CardTitle>
          {tipoRemetente === "diretoria" && (
            <div>
              {isFinalizado ? (
                <Button variant="outline" size="sm" onClick={reabrirChat} className="text-xs gap-1">
                  <Unlock className="h-3 w-3" /> Reabrir
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={finalizarChat} className="text-xs gap-1 text-destructive hover:text-destructive">
                  <Lock className="h-3 w-3" /> Finalizar
                </Button>
              )}
            </div>
          )}
          {produtoId && (
            <Button
              variant={showDocPanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDocPanel(v => !v)}
              className="text-xs gap-1"
            >
              <FolderOpen className="h-3 w-3" />
              Cofre
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Banner finalizado */}
        {isFinalizado && (
          <div className="bg-muted/60 border rounded-lg px-3 py-2 text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
            <Lock className="h-3 w-3" />
            Conversa finalizada. Não é possível enviar novas mensagens.
          </div>
        )}

        {/* Histórico */}
        <div ref={scrollRef} className="h-72 overflow-y-auto border rounded-lg bg-background p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Nenhuma mensagem ainda.
            </div>
          ) : (
            mensagens.map((msg, idx) => {
              const isOwn = msg.usuario_id === currentUserId;
              const insumoNome = getInsumoNome(msg.insumo_id);
              const replyMsg = getReplyMsg(msg.resposta_a_id);
              const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
              const showVersionSep = msg.versao && prevMsg && (prevMsg as MensagemComVersao).versao !== msg.versao;
              const isRead = msg.lida_por && msg.lida_por.length > 0;

              return (
                <React.Fragment key={msg.id}>
                  {showVersionSep && (
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground font-medium">Revisão v{msg.versao}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <Avatar className="h-7 w-7 shrink-0 mt-1">
                      <AvatarFallback className={`text-[10px] font-semibold ${
                        msg.tipo === "diretoria" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {getInitials(msg.usuario_nome)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Bubble */}
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 relative ${
                      isOwn ? "bg-blue-600 text-white" : "bg-muted text-foreground"
                    }`}>
                      {/* Reply quote */}
                      {replyMsg && (
                        <div className={`rounded-md px-2 py-1 mb-1.5 text-[11px] border-l-2 ${
                          isOwn ? "bg-blue-500/40 border-blue-300" : "bg-muted-foreground/10 border-muted-foreground/40"
                        }`}>
                          <span className="font-semibold">{replyMsg.usuario_nome}</span>
                          <p className="truncate opacity-80">{replyMsg.conteudo.substring(0, 80)}</p>
                        </div>
                      )}

                      {/* Header */}
                      <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? "text-blue-100" : "text-muted-foreground"}`}>
                        <span className="text-xs font-semibold">{msg.usuario_nome}</span>
                        {msg.tipo === "diretoria" && (
                          <Badge variant="outline" className={`text-[9px] py-0 px-1 ${isOwn ? "border-blue-300 text-blue-200" : ""}`}>
                            Diretoria
                          </Badge>
                        )}
                        <span className="text-[10px] ml-auto flex items-center gap-0.5">
                          {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          {isOwn && (
                            isRead ? <CheckCheck className="h-3 w-3 text-blue-200" /> : <Check className="h-3 w-3 text-blue-300/60" />
                          )}
                        </span>
                      </div>

                      {/* Insumo tag */}
                      {insumoNome && (
                        <Badge
                          variant={isOwn ? "secondary" : "outline"}
                          className={`text-[10px] mb-1 py-0 ${onNavigateToInsumo ? "cursor-pointer hover:underline" : ""}`}
                          onClick={() => onNavigateToInsumo && msg.insumo_id && onNavigateToInsumo(msg.insumo_id)}
                        >
                          {insumoNome} {onNavigateToInsumo ? "↗" : ""}
                        </Badge>
                      )}

                      {/* Content */}
                      <p className="text-sm whitespace-pre-wrap">{renderConteudoComMencoes(msg.conteudo)}</p>

                      {/* Attachments */}
                      {msg.anexos && msg.anexos.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {msg.anexos.map((anexo, ai) => {
                            const isCofre = !!(anexo as any).enviado_para_cofre;
                            return (
                              <button
                                key={ai}
                                onClick={async () => {
                                  const { signedUrl } = await getSignedUrl("fabrica-revisao-docs", anexo.path);
                                  if (signedUrl) window.open(signedUrl, "_blank");
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs w-full text-left transition-colors ${
                                  isCofre
                                    ? "bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900"
                                    : isOwn
                                      ? "bg-blue-500/30 hover:bg-blue-500/50"
                                      : "bg-muted hover:bg-muted-foreground/10"
                                }`}
                              >
                                {isCofre ? <Shield className="h-3 w-3 shrink-0 text-emerald-600" /> : <FileText className="h-3 w-3 shrink-0" />}
                                <span className="truncate flex-1">{anexo.nome}</span>
                                {isCofre && (
                                  <Badge variant="outline" className="text-[8px] py-0 px-1 border-emerald-400 text-emerald-700 shrink-0">Cofre</Badge>
                                )}
                                <Download className="h-3 w-3 shrink-0 opacity-60" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Reply action */}
                      {!isFinalizado && (
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className={`absolute -top-2 ${isOwn ? "left-0 -translate-x-full" : "right-0 translate-x-full"} opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-full p-1 shadow-sm`}
                          title="Responder"
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
          <div className="space-y-2">
            {/* Reply preview */}
            {replyingTo && (
              <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-3 py-2">
                <Reply className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-blue-600">{replyingTo.usuario_nome}</span>
                  <p className="text-xs text-muted-foreground truncate">{replyingTo.conteudo.substring(0, 100)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyingTo(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Insumo selector */}
            {insumos.length > 0 && (
              <Select value={insumoSelecionado} onValueChange={setInsumoSelecionado}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Contextualizar com insumo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem referência a insumo</SelectItem>
                  {insumos.map((i) => {
                    const deveRevisar = insumosComApontamento.has(i.id);
                    return (
                      <SelectItem key={i.id} value={i.id}>
                        <span className={deveRevisar ? "text-destructive font-semibold" : ""}>
                          {i.codigo} - {i.nome}
                          {deveRevisar && " — Revisar"}
                        </span>
                      </SelectItem>
                    );
                  })}
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

            {/* Pending attachments preview */}
            {anexosPendentes.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {anexosPendentes.map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] gap-1">
                      <Paperclip className="h-2.5 w-2.5" />
                      {f.name.length > 20 ? f.name.substring(0, 17) + "..." : f.name}
                      <button onClick={() => setAnexosPendentes(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enviarParaCofre}
                    onChange={(e) => setEnviarParaCofre(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-input accent-primary"
                  />
                  <span className="text-[10px] text-muted-foreground">Vincular ao Cofre de Documentos do produto</span>
                </label>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setAnexosPendentes(prev => [...prev, ...files]);
                e.target.value = "";
              }}
            />

            {/* Text input + mention popover */}
            <div className="flex gap-2 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-auto shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivos"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    tipoRemetente === "diretoria"
                      ? "Responder ao responsável... (use @ para mencionar)"
                      : "Justificar ou enviar mensagem... (use @ para mencionar)"
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
                  title="Mencionar usuário"
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
                disabled={(!texto.trim() && anexosPendentes.length === 0) || enviando || uploadingAnexos}
                className="h-auto"
              >
                {enviando || uploadingAnexos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
      </ResizablePanel>

      {showDocPanel && produtoId && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
            <div className="h-full p-3 overflow-auto">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold">Cofre de Documentos</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setShowDocPanel(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <DocumentosTab produtoId={produtoId} />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
