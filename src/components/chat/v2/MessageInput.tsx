import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paperclip, Smile, Send, X, Reply, Loader2, Image as ImageIcon, ClipboardCheck, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMensagem } from "@/hooks/chat/types";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { uploadChatAnexo, formatBytes } from "./utils";
import { CameraCaptureButton } from "./CameraCaptureButton";
import { EmojiPicker } from "./EmojiPicker";
import { MentionAutocomplete, type MentionMember } from "./MentionAutocomplete";
import { TaskMentionAutocomplete, type TaskMention } from "./TaskMentionAutocomplete";
import { SofiaCommandPopover, type SofiaCommand } from "./SofiaCommandPopover";
import { NovaAprovacaoDialog } from "./NovaAprovacaoDialog";
import { UrgentSendDialog } from "./UrgentSendDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useChatDraft } from "@/hooks/chat/useChatDraft";

interface Props {
  conversaId: string;
  responderA: ChatMensagem | null;
  onClearReply: () => void;
  onTyping: () => void;
}

export function MessageInput({ conversaId, responderA, onClearReply, onTyping }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  // Rascunho persistente por conversa (localStorage). Trocar de conversa
  // no meio de uma mensagem longa não perde o texto digitado.
  const { draft: txt, setDraft: setTxt, clearDraft } = useChatDraft(conversaId);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  /** uuids dos usuários mencionados nesta mensagem (vai junto no sendMessage). */
  const [mentions, setMentions] = useState<string[]>([]);
  /** Quando != null, o popover de @ autocomplete está aberto.
   *  query = o texto após o `@` (filtro). startIdx = posição do `@` no `txt`. */
  const [mentionState, setMentionState] = useState<{ query: string; startIdx: number } | null>(null);
  /** Tarefas mencionadas via /tarefa — vão em metadata.tarefas no sendMessage. */
  const [tarefasMencionadas, setTarefasMencionadas] = useState<{ id: string; label: string }[]>([]);
  /** Popover de /tarefa autocomplete. startIdx é a posição do `/` no texto. */
  const [taskMentionState, setTaskMentionState] = useState<{ query: string; startIdx: number; length: number } | null>(null);
  /** Popover de comandos da Sofia (/sofia, /resumir). Aberto quando o texto
   *  começa com `/` e ainda não casa com `/tarefa` (que tem popover próprio). */
  const [sofiaState, setSofiaState] = useState<{ query: string } | null>(null);
  const [sofiaLoading, setSofiaLoading] = useState(false);
  const [aprovacaoOpen, setAprovacaoOpen] = useState(false);
  const [urgenteOpen, setUrgenteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useChatActions();

  useEffect(() => { taRef.current?.focus(); }, [conversaId, responderA]);

  // Reset mentions ao trocar de conversa
  useEffect(() => {
    setMentions([]);
    setMentionState(null);
    setTarefasMencionadas([]);
    setTaskMentionState(null);
    setSofiaState(null);
  }, [conversaId]);

  /** Detecta se o cursor está dentro de uma menção ativa.
   *  Regra: o último `@` antes do cursor sem espaço/quebra de linha entre
   *  ele e o cursor abre o popover. Query = caracteres do `@+1` até o cursor. */
  const checkMentionContext = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return null;
    // Se há espaço/linebreak entre @ e cursor, não é mais menção
    const fragment = before.slice(atIdx + 1);
    if (/[\s\n]/.test(fragment)) return null;
    // Evita @ em meio a palavra (ex: email@dominio) — só ativa se antes
    // do @ for início, espaço ou quebra de linha
    const charBefore = atIdx > 0 ? before[atIdx - 1] : "";
    if (charBefore && !/[\s\n]/.test(charBefore)) return null;
    return { query: fragment, startIdx: atIdx };
  };

  /** Detecta `/tarefa <query>` antes do cursor (mesma regra do @, mas com
   *  prefixo de comando). Aceita query vazia (popover lista tarefas recentes). */
  const checkTaskMentionContext = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const idx = before.lastIndexOf("/tarefa");
    if (idx === -1) return null;
    const charBefore = idx > 0 ? before[idx - 1] : "";
    if (charBefore && !/[\s\n]/.test(charBefore)) return null;
    const fragment = before.slice(idx + "/tarefa".length);
    // Aceita: vazio (acabou de digitar `/tarefa`) ou começando com espaço
    if (fragment && !/^\s/.test(fragment)) return null;
    if (/\n/.test(fragment)) return null;
    return { query: fragment.trim(), startIdx: idx, length: "/tarefa".length + fragment.length };
  };

  /** Detecta comando da Sofia: o texto inteiro começa com `/` e NÃO é `/tarefa`. */
  const checkSofiaContext = (text: string): { query: string } | null => {
    if (!text.startsWith("/")) return null;
    // /tarefa tem seu próprio popover — não conflita
    if (text.startsWith("/tarefa") && (text.length === "/tarefa".length || /[\s]/.test(text["/tarefa".length]))) return null;
    // Primeira linha sem espaço extra = só o nome do comando ou comando+arg
    const firstSpace = text.indexOf(" ");
    const cmdToken = firstSpace === -1 ? text : text.slice(0, firstSpace);
    return { query: cmdToken.replace(/^\//, "") };
  };

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTxt(value);
    const caret = e.target.selectionStart ?? value.length;
    setMentionState(checkMentionContext(value, caret));
    setTaskMentionState(checkTaskMentionContext(value, caret));
    setSofiaState(checkSofiaContext(value));
  };

  /** Executa um comando da Sofia. /resumir é imediato; /sofia precisa de prompt. */
  const executarSofia = async (cmd: SofiaCommand) => {
    if (cmd.immediate) {
      // /resumir — chama direto sem precisar de prompt
      setSofiaLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("chat-sofia-command", {
          body: { conversa_id: conversaId, command: cmd.key },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error("Sofia não respondeu");
        clearDraft();
        setSofiaState(null);
        toast.success("Resumo da Sofia postado no chat");
      } catch (e: any) {
        toast.error("Sofia: " + (e?.message ?? "falhou"));
      } finally {
        setSofiaLoading(false);
      }
      return;
    }
    // /sofia — preenche o texto pro usuário continuar digitando
    setTxt(cmd.label + " ");
    setSofiaState(null);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      const pos = cmd.label.length + 1;
      taRef.current?.setSelectionRange(pos, pos);
    });
  };

  const pickTask = (t: TaskMention) => {
    if (!taskMentionState) return;
    // Substitui o `/tarefa <query>` por `[#tarefa: titulo]` no texto
    const antes = txt.slice(0, taskMentionState.startIdx);
    const depois = txt.slice(taskMentionState.startIdx + taskMentionState.length);
    const marker = `[#tarefa: ${t.titulo}] `;
    const novo = `${antes}${marker}${depois}`;
    setTxt(novo);
    setTarefasMencionadas((prev) =>
      prev.some((p) => p.id === t.id) ? prev : [...prev, { id: t.id, label: t.titulo }],
    );
    setTaskMentionState(null);
    requestAnimationFrame(() => {
      if (taRef.current) {
        const pos = antes.length + marker.length;
        taRef.current.focus();
        taRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const pickMention = (m: MentionMember) => {
    if (!mentionState) return;
    const nome = (m.nome ?? "Usuário").replace(/\s+/g, " ").trim();
    // Substitui o `@query` por `@Nome ` no texto
    const antes = txt.slice(0, mentionState.startIdx);
    const depois = txt.slice(mentionState.startIdx + 1 + mentionState.query.length);
    const novo = `${antes}@${nome} ${depois}`;
    setTxt(novo);
    // Adiciona uuid em mentions (sem duplicar)
    setMentions((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
    setMentionState(null);
    // Foca de novo no textarea, posicionando o cursor após o `@Nome `
    requestAnimationFrame(() => {
      if (taRef.current) {
        const pos = antes.length + 1 + nome.length + 1; // @ + nome + espaço
        taRef.current.focus();
        taRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const enviar = async () => {
    const conteudo = txt.trim();
    if (!conteudo && files.length === 0) return;

    // Intercepta /sofia <prompt> — chama edge function em vez de enviar
    // como mensagem normal (a Sofia entra como resposta automática).
    if (conteudo.startsWith("/sofia ")) {
      const prompt = conteudo.slice("/sofia ".length).trim();
      if (!prompt) return toast.error("Digite a pergunta após /sofia");
      setSofiaLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("chat-sofia-command", {
          body: { conversa_id: conversaId, command: "sofia", prompt },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error("Sofia não respondeu");
        clearDraft();
        setSofiaState(null);
      } catch (e: any) {
        toast.error("Sofia: " + (e?.message ?? "falhou"));
      } finally {
        setSofiaLoading(false);
      }
      return;
    }

    setUploading(true);
    try {
      const anexosMeta = [];
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`Arquivo ${f.name} excede 20 MB`);
          continue;
        }
        const meta = await uploadChatAnexo(conversaId, uid, f);
        anexosMeta.push(meta);
      }
      const tipo = anexosMeta.length > 0 && !conteudo
        ? (anexosMeta[0].mime_type.startsWith("image/") ? "imagem"
          : anexosMeta[0].mime_type.startsWith("video/") ? "video"
          : anexosMeta[0].mime_type.startsWith("audio/") ? "audio"
          : "arquivo")
        : "texto";
      await sendMessage.mutateAsync({
        conversaId,
        conteudo,
        tipo: tipo as any,
        responde_a_id: responderA?.id ?? null,
        anexos: anexosMeta,
        mencoes: mentions.length ? mentions : undefined,
        metadata: tarefasMencionadas.length
          ? { tarefas: tarefasMencionadas }
          : undefined,
      });
      clearDraft();
      setFiles([]);
      setMentions([]);
      setMentionState(null);
      setTarefasMencionadas([]);
      setTaskMentionState(null);
      onClearReply();
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e?.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape fecha popovers de menção / sofia
    if (e.key === "Escape" && (mentionState || taskMentionState || sofiaState)) {
      e.preventDefault();
      setMentionState(null);
      setTaskMentionState(null);
      setSofiaState(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !mentionState && !taskMentionState) {
      e.preventDefault();
      enviar();
    } else {
      onTyping();
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  };

  return (
    <div className="border-t border-border bg-card relative">
      {/* Popover de @ autocomplete — fica posicionado acima do textarea.
          Não tenta pixel-perfect na posição do @ no texto; pra v1 é
          aceitável estar acima do input inteiro. */}
      {mentionState && (
        <div className="absolute bottom-full left-0 mb-1 ml-12 z-50 bg-popover border border-border rounded-md shadow-lg">
          <MentionAutocomplete
            conversaId={conversaId}
            query={mentionState.query}
            ownUid={uid}
            onPick={pickMention}
          />
        </div>
      )}
      {taskMentionState && !mentionState && (
        <div className="absolute bottom-full left-0 mb-1 ml-12 z-50 bg-popover border border-border rounded-md shadow-lg">
          <TaskMentionAutocomplete
            query={taskMentionState.query}
            onPick={pickTask}
          />
        </div>
      )}
      {sofiaState && !mentionState && !taskMentionState && (
        <div className="absolute bottom-full left-0 mb-1 ml-12 z-50 bg-popover border border-border rounded-md shadow-lg">
          <SofiaCommandPopover
            query={sofiaState.query}
            onPick={executarSofia}
          />
        </div>
      )}

      {responderA && (
        <div className="px-3 py-2 border-b border-border flex items-start gap-2 bg-muted/40">
          <Reply className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium text-primary">Respondendo a {responderA.remetente?.nome ?? "mensagem"}</p>
            <p className="truncate text-muted-foreground">{responderA.conteudo || "Anexo"}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClearReply}><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}

      {files.length > 0 && (
        <div className="px-3 py-2 border-b border-border flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs">
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tarefasMencionadas.length > 0 && (
        <div className="px-3 py-2 border-b border-border flex flex-wrap gap-2">
          {tarefasMencionadas.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-md px-2 py-1 text-xs">
              <span>📋</span>
              <span className="max-w-[180px] truncate">{t.label}</span>
              <button
                onClick={() => setTarefasMencionadas((prev) => prev.filter((p) => p.id !== t.id))}
                className="hover:text-destructive"
                aria-label="Remover menção de tarefa"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 py-2 flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} title="Anexar arquivo" aria-label="Anexar arquivo">
          <Paperclip className="h-4 w-4" />
        </Button>
        <CameraCaptureButton onCapture={(file) => setFiles((prev) => [...prev, file].slice(0, 10))} disabled={uploading} />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          onClick={() => setAprovacaoOpen(true)}
          disabled={uploading || sofiaLoading}
          title="Solicitar aprovação"
          aria-label="Solicitar aprovação"
        >
          <ClipboardCheck className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setUrgenteOpen(true)}
          disabled={uploading || sofiaLoading}
          title="Chamar atenção (mensagem urgente)"
          aria-label="Chamar atenção da equipe"
        >
          <AlertOctagon className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"><Smile className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-0">
            <EmojiPicker onPick={(e) => setTxt(txt + e)} />
          </PopoverContent>
        </Popover>
        <Textarea
          ref={taRef}
          value={txt}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          onClick={(e) => {
            // Re-checa contexto ao clicar (caso usuário mova cursor)
            const ta = e.currentTarget;
            setMentionState(checkMentionContext(ta.value, ta.selectionStart ?? ta.value.length));
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.files ?? []);
            if (items.length) { e.preventDefault(); addFiles(e.clipboardData.files); }
          }}
          placeholder="Digite... (@ pessoa · /tarefa · /sofia · /resumir · 📋 aprovação no menu)"
          rows={1}
          className={cn("resize-none min-h-[40px] max-h-32 py-2.5 leading-snug")}
        />
        <Button onClick={enviar} disabled={uploading || sofiaLoading || (!txt.trim() && files.length === 0)} size="icon" className="h-9 w-9 shrink-0 rounded-full">
          {uploading || sofiaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <NovaAprovacaoDialog open={aprovacaoOpen} onOpenChange={setAprovacaoOpen} conversaId={conversaId} />
      <UrgentSendDialog
        open={urgenteOpen}
        onOpenChange={setUrgenteOpen}
        conversaId={conversaId}
        conteudoInicial={txt}
        respondeAId={responderA?.id ?? null}
        onSent={() => { clearDraft(); onClearReply(); }}
      />
    </div>
  );
}
