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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare, Send, Loader2, Reply, X, Check, CheckCheck,
  Lock, Unlock, AtSign, Package, FileText, ClipboardList,
  Paperclip, Sparkles, Languages, Wand2, ListTree,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { useUserLanguage, LANGUAGE_LABEL, LANGUAGE_FLAG, type UserLanguage } from "@/hooks/useUserLanguage";
import { invokeChat } from "@/lib/ai/invokeChat";
import { validateFileForUpload } from "@/lib/utils/file-security";
import { MessageTranslation } from "./chat/MessageTranslation";
import { ChatAttachmentChip, type ChatAnexo } from "./chat/ChatAttachmentChip";
import { ChatIaActionCard, type IaToolProposal } from "./chat/ChatIaActionCard";
import { ChatComposerActionsBar } from "@/components/chat/v2/ChatComposerActionsBar";
import { useAbrirAcaoVinculada } from "@/hooks/chat/useAbrirAcaoVinculada";


interface Mensagem {
  id: string;
  submissao_id: string;
  usuario_id: string;
  usuario_nome: string;
  conteudo: string;
  tipo: "china" | "brasil" | "ia";
  ref_tipo: string | null;
  ref_id: string | null;
  ref_label: string | null;
  resposta_a_id: string | null;
  mencoes: { user_id: string; nome: string }[];
  lida_por: string[];
  anexos: ChatAnexo[];
  idioma_origem: string | null;
  traducoes: Record<string, string> | null;
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
  referenciasDisponiveis?: RefOption[];
}

const IA_USER_ID = "00000000-0000-0000-0000-000000000001"; // sentinela para mensagens IA
const IA_USER_NAME = "Assistente IA";

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function renderConteudoComMencoes(texto: string): React.ReactNode {
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

export function ChinaChatPanel({ submissaoId, produtoNome, tipoRemetente, referenciasDisponiveis = [] }: Props) {
  const { abrirAprovacao, abrirUrgente } = useAbrirAcaoVinculada();
  const { language: leitorIdioma, setLanguage } = useUserLanguage();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [iaPensando, setIaPensando] = useState<null | "ask" | "suggest" | "summary" | "actions">(null);
  const [sumario, setSumario] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<IaToolProposal[]>([]);
  const [executingPropostaId, setExecutingPropostaId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [refSelecionada, setRefSelecionada] = useState<string>("none");
  const [replyingTo, setReplyingTo] = useState<Mensagem | null>(null);
  const [chatStatus, setChatStatus] = useState<string>("aberto");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mencoesSelecionadas, setMencoesSelecionadas] = useState<{ user_id: string; nome: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Load profiles for mentions
  useEffect(() => {
    (async () => {
      const profiles = new Map<string, { id: string; nome: string }>();
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("aprovado", true)
        .not("nome", "is", null);
      for (const u of allProfiles || []) {
        if (u.nome) profiles.set(u.id, { id: u.id, nome: u.nome });
      }
      const { data: participantes } = await supabase
        .from("china_chat_mensagens" as any)
        .select("usuario_id, usuario_nome")
        .eq("submissao_id", submissaoId);
      for (const p of (participantes || []) as any[]) {
        if (p.usuario_id && p.usuario_nome && !profiles.has(p.usuario_id)) {
          profiles.set(p.usuario_id, { id: p.usuario_id, nome: p.usuario_nome });
        }
      }
      // IA como participante mencionável
      profiles.set(IA_USER_ID, { id: IA_USER_ID, nome: "IA" });
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
        traducoes: m.traducoes || {},
      })));
    }
    setLoading(false);
  }, [submissaoId]);

  useEffect(() => { carregarMensagens(); }, [carregarMensagens]);

  // Realtime — INSERT e UPDATE (para receber traduções em background)
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName(`china-chat-${submissaoId}`))
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "china_chat_mensagens",
        filter: `submissao_id=eq.${submissaoId}`,
      }, (payload) => {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === (payload.new as any).id)) return prev;
          const newMsg = payload.new as any;
          return [...prev, {
            ...newMsg,
            mencoes: newMsg.mencoes || [],
            lida_por: newMsg.lida_por || [],
            anexos: newMsg.anexos || [],
            traducoes: newMsg.traducoes || {},
          }];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "china_chat_mensagens",
        filter: `submissao_id=eq.${submissaoId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setMensagens((prev) => prev.map((m) =>
          m.id === updated.id
            ? { ...m, traducoes: updated.traducoes || {}, idioma_origem: updated.idioma_origem, lida_por: updated.lida_por || [] }
            : m
        ));
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

  // Tradução automática: garante que toda mensagem visível tenha tradução para o idioma do leitor
  useEffect(() => {
    const pendentes = mensagens.filter((m) => {
      if (!m.id) return false;
      if (translatingIds.has(m.id)) return false;
      const origem = m.idioma_origem;
      if (!origem) return true; // ainda não detectado — backend detecta + traduz
      if (origem === leitorIdioma) return false;
      return !(m.traducoes && m.traducoes[leitorIdioma]);
    });
    if (pendentes.length === 0) return;

    setTranslatingIds((prev) => {
      const next = new Set(prev);
      pendentes.forEach((m) => next.add(m.id));
      return next;
    });

    pendentes.forEach(async (m) => {
      try {
        await invokeChat("china-chat-traduzir", { mensagem_id: m.id }, { timeoutMs: 30_000 });
      } catch { /* ignora — realtime atualiza */ }
      finally {
        setTranslatingIds((prev) => {
          const next = new Set(prev);
          next.delete(m.id);
          return next;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens, leitorIdioma]);

  // ===== Anexos =====
  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 3); // max 3 por mensagem
    const erros: string[] = [];
    const ok: File[] = [];
    for (const f of arr) {
      const v = await validateFileForUpload(f);
      if (!v.valid) erros.push(`${f.name}: ${v.error}`);
      else if (f.size > 10 * 1024 * 1024) erros.push(`${f.name}: maior que 10 MB`);
      else if (!/^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(f.type)) erros.push(`${f.name}: formato não suportado`);
      else ok.push(f);
    }
    if (erros.length) erros.forEach((e) => toast.error(e));
    if (ok.length) setPendingFiles((prev) => [...prev, ...ok]);
  };

  const uploadAnexos = async (): Promise<ChatAnexo[]> => {
    if (pendingFiles.length === 0) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sem usuário autenticado");
    setUploadingAnexo(true);
    try {
      const out: ChatAnexo[] = [];
      for (const file of pendingFiles) {
        const ext = file.name.split(".").pop() || "bin";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${submissaoId}/${user.id}/${safeName}`;
        const { error } = await supabase.storage.from("china-chat-anexos").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (error) throw error;
        out.push({ path, nome: file.name, mime: file.type, size: file.size });
      }
      return out;
    } finally {
      setUploadingAnexo(false);
    }
  };

  // ===== Envio =====
  const enviarMensagem = async () => {
    if ((!texto.trim() && pendingFiles.length === 0) || chatStatus === "finalizado") return;

    // Detectar @IA — se aparecer, dispara IA em modo "ask" depois do envio
    const querIa = /@IA\b/i.test(texto);

    setEnviando(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const nome = user?.user_metadata?.nome || user?.email || "Usuário";

      let ref_tipo: string | null = null;
      let ref_id: string | null = null;
      let ref_label: string | null = null;
      if (refSelecionada !== "none") {
        const ref = referenciasDisponiveis.find(r => `${r.tipo}:${r.id}` === refSelecionada);
        if (ref) { ref_tipo = ref.tipo; ref_id = ref.id; ref_label = ref.label; }
      }

      const anexosUp = await uploadAnexos();

      const inserted = await supabase.from("china_chat_mensagens" as any).insert({
        submissao_id: submissaoId,
        usuario_id: user?.id,
        usuario_nome: nome,
        conteudo: texto.trim(),
        tipo: tipoRemetente,
        ref_tipo, ref_id, ref_label,
        resposta_a_id: replyingTo?.id || null,
        mencoes: mencoesSelecionadas.length > 0 ? mencoesSelecionadas : [],
        anexos: anexosUp,
      } as any).select("id").single();

      const newId = (inserted.data as any)?.id as string | undefined;

      setTexto("");
      setRefSelecionada("none");
      setReplyingTo(null);
      setMencoesSelecionadas([]);
      setPendingFiles([]);

      // Disparar tradução em background (idempotente)
      if (newId) {
        invokeChat("china-chat-traduzir", { mensagem_id: newId }, { timeoutMs: 30_000 }).catch(() => {});
      }

      if (querIa) {
        const pergunta = texto.replace(/@IA\b/gi, "").trim();
        if (pergunta) chamarIa("ask", pergunta);
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  // ===== IA =====
  const chamarIa = async (modo: "ask" | "suggest" | "summary" | "actions", pergunta?: string) => {
    setIaPensando(modo);
    try {
      const { data, error } = await invokeChat<{
        ok: boolean; modo: string; reply: string;
        tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> | null;
      }>("china-chat-ia", { submissao_id: submissaoId, modo, pergunta, idioma: leitorIdioma });

      if (error) { toast.error(error.userMessage); return; }
      if (!data) return;

      if (modo === "summary") {
        setSumario(data.reply || "Sem conteúdo suficiente para resumir.");
        return;
      }
      if (modo === "suggest") {
        // Insere o primeiro rascunho no campo, o usuário pode editar antes de enviar
        const lines = (data.reply || "").split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean);
        if (lines.length > 0) {
          setTexto(lines[0]);
          // mostra os outros via toast
          if (lines.length > 1) {
            toast.message("Outros rascunhos sugeridos", {
              description: lines.slice(1, 3).join("\n\n"),
              duration: 8000,
            });
          }
          textareaRef.current?.focus();
        } else {
          toast.error("IA não retornou rascunhos");
        }
        return;
      }
      if (modo === "ask") {
        // Posta como mensagem de IA visível para todos
        if (!data.reply) return;
        await supabase.from("china_chat_mensagens" as any).insert({
          submissao_id: submissaoId,
          usuario_id: IA_USER_ID,
          usuario_nome: IA_USER_NAME,
          conteudo: data.reply,
          tipo: "ia",
          idioma_origem: leitorIdioma,
        } as any);
        return;
      }
      if (modo === "actions") {
        const calls = data.tool_calls || [];
        if (calls.length === 0) {
          toast.message("IA: sem ação clara", { description: data.reply || "Sem proposta de ação." });
          return;
        }
        const novas: IaToolProposal[] = calls.map((c) => ({
          id: c.id || crypto.randomUUID(),
          nome: c.function?.name || "?",
          args: safeJson(c.function?.arguments) || {},
        }));
        setPropostas((prev) => [...prev, ...novas]);
      }
    } finally {
      setIaPensando(null);
    }
  };

  const executarProposta = async (p: IaToolProposal) => {
    setExecutingPropostaId(p.id);
    try {
      switch (p.nome) {
        case "marcar_lida": {
          if (!currentUserId) throw new Error("Sem usuário");
          const ids = mensagens.filter((m) => !(m.lida_por || []).includes(currentUserId)).map((m) => m.id);
          for (const id of ids) {
            const msg = mensagens.find((m) => m.id === id);
            if (!msg) continue;
            await supabase.from("china_chat_mensagens" as any)
              .update({ lida_por: [...(msg.lida_por || []), currentUserId] } as any)
              .eq("id", id);
          }
          toast.success("Marcado como lido");
          break;
        }
        case "pedir_ajuste":
        case "encaminhar_responsavel":
        case "aprovar_submissao": {
          // Estas ações têm telas próprias (Caixa de Entrada / Vincular). Inserimos
          // a sugestão no chat e instruímos o usuário a finalizar lá.
          const motivo = p.args.motivo || p.args.justificativa || p.args.sugestao_nome || "";
          await supabase.from("china_chat_mensagens" as any).insert({
            submissao_id: submissaoId,
            usuario_id: IA_USER_ID,
            usuario_nome: IA_USER_NAME,
            conteudo: `Ação proposta confirmada: **${p.nome}**${motivo ? ` — ${motivo}` : ""}.\nUse o painel de ações da submissão para finalizar.`,
            tipo: "ia",
            idioma_origem: "pt",
          } as any);
          toast.success("Proposta registrada no chat. Finalize no painel de ações.");
          break;
        }
        default:
          toast.error("Ação desconhecida");
      }
      setPropostas((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      toast.error(err.message || "Falha ao executar ação");
    } finally {
      setExecutingPropostaId(null);
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
    if (user.id !== IA_USER_ID) {
      setMencoesSelecionadas(prev => prev.some(m => m.user_id === user.id) ? prev : [...prev, { user_id: user.id, nome: user.nome }]);
    }
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
      <div className="px-4 py-3 border-b bg-card flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Chat 聊天</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {mensagens.length} mensagen{mensagens.length !== 1 ? "s" : ""}
          </span>
          {isFinalizado && (
            <Badge variant="outline" className="text-[10px] py-0 gap-0.5">
              <Lock className="h-2.5 w-2.5" /> Finalizado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Idioma */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" title="Idioma de leitura">
                <Languages className="h-3.5 w-3.5" />
                <span className="font-semibold">{LANGUAGE_FLAG[leitorIdioma]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["pt", "zh", "en"] as UserLanguage[]).map((l) => (
                <DropdownMenuItem key={l} onClick={() => setLanguage(l)} className="text-xs">
                  <span className="font-mono w-6">{LANGUAGE_FLAG[l]}</span>
                  {LANGUAGE_LABEL[l]}
                  {leitorIdioma === l && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Resumir */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs px-2"
                onClick={() => { if (!sumario) chamarIa("summary"); }}
                disabled={iaPensando === "summary" || mensagens.length === 0}
                title="Resumir conversa"
              >
                {iaPensando === "summary"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <ListTree className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">Resumir</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] text-sm" align="end">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
                <span className="font-semibold text-xs">Resumo da conversa</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => { setSumario(null); chamarIa("summary"); }} title="Atualizar">
                  <Wand2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {iaPensando === "summary" ? <span className="text-muted-foreground">Gerando...</span> : (sumario || "Clique em Resumir para gerar.")}
              </div>
            </PopoverContent>
          </Popover>

          {tipoRemetente === "brasil" && (
            isFinalizado ? (
              <Button variant="ghost" size="sm" onClick={reabrirChat} className="text-[10px] h-7 gap-0.5">
                <Unlock className="h-3 w-3" /> Reabrir
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={finalizarChat} className="text-[10px] h-7 gap-0.5 text-destructive hover:text-destructive">
                <Lock className="h-3 w-3" /> Finalizar
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
            const isIa = msg.tipo === "ia";
            const isMine = !isIa && msg.usuario_id === currentUserId;
            const replyMsg = getReplyMsg(msg.resposta_a_id);
            const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
            const isRead = msg.lida_por && msg.lida_por.length > 0;

            const msgDateKey = getDateKey(msg.created_at);
            const prevDateKey = prevMsg ? getDateKey(prevMsg.created_at) : null;
            const showDateSep = !prevMsg || msgDateKey !== prevDateKey;
            const isSameSender = prevMsg && prevMsg.usuario_id === msg.usuario_id && prevMsg.tipo === msg.tipo && !showDateSep;

            // Lado: minhas mensagens à direita; IA centro; outros à esquerda
            const align: "left" | "right" | "center" = isIa ? "center" : isMine ? "right" : "left";

            // Cores via tokens semânticos
            let bubbleClass = "";
            let isLightBg = true;
            if (isIa) {
              bubbleClass = "bg-accent text-accent-foreground border border-dashed border-accent-foreground/30";
            } else if (isMine) {
              bubbleClass = "bg-primary text-primary-foreground";
              isLightBg = false;
            } else if (isChina) {
              bubbleClass = "bg-secondary text-secondary-foreground border border-border";
            } else {
              bubbleClass = "bg-muted text-foreground border border-border";
            }

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
                <div className={`flex gap-2 group ${
                  align === "right" ? "flex-row-reverse" : align === "center" ? "justify-center" : ""
                } ${isSameSender ? "mt-0.5" : "mt-2"}`}>
                  {align !== "center" && (
                    !isSameSender ? (
                      <Avatar className="h-7 w-7 shrink-0 mt-1">
                        <AvatarFallback className={`text-[10px] font-semibold ${
                          isChina ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
                        }`}>
                          {getInitials(msg.usuario_nome)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-7 shrink-0" />
                    )
                  )}

                  <div className={`max-w-[78%] rounded-xl px-3 py-2 relative ${bubbleClass}`}>
                    {replyMsg && (
                      <div className={`rounded-md px-2 py-1 mb-1.5 text-[11px] border-l-2 ${
                        isLightBg ? "bg-background/60 border-primary" : "bg-primary-foreground/15 border-primary-foreground/40"
                      }`}>
                        <span className="font-semibold">{replyMsg.usuario_nome}</span>
                        <p className="truncate opacity-80">{replyMsg.conteudo.substring(0, 80)}</p>
                      </div>
                    )}

                    {!isSameSender && (
                      <div className={`flex items-center gap-2 mb-0.5 ${isLightBg ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
                        <span className="text-xs font-semibold">{msg.usuario_nome}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                          {isIa ? "IA" : isChina ? "China 中国" : "Brasil 巴西"}
                        </Badge>
                        <span className="text-[10px] ml-auto flex items-center gap-0.5">
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                          {isMine && (
                            isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3 opacity-60" />
                          )}
                        </span>
                      </div>
                    )}

                    {isSameSender && (
                      <div className={`flex justify-end mb-0.5 ${isLightBg ? "text-muted-foreground/70" : "text-primary-foreground/60"}`}>
                        <span className="text-[9px] flex items-center gap-0.5">
                          {format(new Date(msg.created_at), "HH:mm")}
                          {isMine && (
                            isRead ? <CheckCheck className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />
                          )}
                        </span>
                      </div>
                    )}

                    {msg.ref_tipo && msg.ref_label && (
                      <Badge variant="outline" className="text-[10px] mb-1 py-0 gap-1">
                        {REF_ICONS[msg.ref_tipo] || <FileText className="h-3 w-3" />}
                        {msg.ref_label}
                      </Badge>
                    )}

                    <MessageTranslation
                      conteudo={msg.conteudo}
                      idiomaOrigem={msg.idioma_origem}
                      traducoes={msg.traducoes}
                      leitorIdioma={leitorIdioma}
                      isTranslating={translatingIds.has(msg.id)}
                      renderConteudo={renderConteudoComMencoes}
                      isLightBg={isLightBg}
                    />

                    {(msg.anexos || []).map((a, i) => (
                      <ChatAttachmentChip
                        key={i}
                        anexo={a}
                        isLightBg={isLightBg}
                        mensagemId={msg.id}
                        submissaoId={submissaoId}
                      />
                    ))}

                    {!isFinalizado && !isIa && (
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className={`absolute -top-2 ${align === "right" ? "left-0 -translate-x-full" : "right-0 translate-x-full"} opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-full p-1 shadow-sm`}
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

        {/* Propostas de ação da IA */}
        {propostas.map((p) => (
          <ChatIaActionCard
            key={p.id}
            proposta={p}
            onConfirmar={executarProposta}
            onDescartar={(id) => setPropostas((prev) => prev.filter((x) => x.id !== id))}
            disabled={executingPropostaId === p.id}
          />
        ))}
      </div>

      {/* Input area */}
      {!isFinalizado && (
        <div className="border-t bg-card p-3 space-y-2 shrink-0">
          {/* IA toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => chamarIa("suggest")} disabled={!!iaPensando}>
              {iaPensando === "suggest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Sugerir resposta
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => chamarIa("actions")} disabled={!!iaPensando}>
              {iaPensando === "actions" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Ações sugeridas
            </Button>
            <span className="text-[10px] text-muted-foreground ml-auto">
              Dica: digite <span className="font-mono">@IA</span> para chamar a assistente no chat
            </span>
          </div>

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

          {/* Anexos pendentes */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pendingFiles.map((f, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1 max-w-[200px]">
                  <Paperclip className="h-2.5 w-2.5" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-muted-foreground">({(f.size / 1024).toFixed(0)} KB)</span>
                  <button onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}>
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
                    ? "发送消息... (@提及, @IA pergunta) / Enviar mensagem..."
                    : "Enviar mensagem... (@ para mencionar, @IA para perguntar à IA)"
                }
                className="min-h-[60px] text-sm resize-none pr-16"
                rows={2}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => { handleSelectFiles(e.target.files); e.target.value = ""; }}
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo (imagem ou PDF, até 10 MB) 附件"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary"
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
              </div>

              {mentionOpen && filteredUsuarios.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredUsuarios.map(u => (
                    <button
                      key={u.id}
                      onClick={() => insertMention(u)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className={`text-[8px] ${u.id === IA_USER_ID ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"}`}>
                          {u.id === IA_USER_ID ? "IA" : getInitials(u.nome)}
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
              disabled={(!texto.trim() && pendingFiles.length === 0) || enviando || uploadingAnexo}
              className="h-auto"
            >
              {enviando || uploadingAnexo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function safeJson(s: string | undefined | null): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
