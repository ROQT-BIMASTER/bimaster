/**
 * TarefaChatPanel — painel central do hub de Chat quando o usuário seleciona
 * uma tarefa (ou subtarefa) na aba "Tarefas". Reusa `useProjetoTarefaDetalhe`
 * para mensagens em `projeto_tarefa_messages` e dispara `marcarTarefaChatLida`
 * ao abrir, para zerar o badge de não lidas na sidebar e no sino global.
 *
 * Suporta anexar documentos diretamente no chat (upload reaproveita o storage
 * `projeto-anexos` da própria tarefa), com preview inline para imagens e
 * card de download para outros formatos. Cada anexo também aparece em
 * "Anexos" no detalhe da tarefa, e o card tem link direto para abri-lo lá.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  MessageSquare,
  Send,
  CheckSquare,
  GitBranch,
  Briefcase,
  Paperclip,
  Loader2,
  FileText,
  Download,
  VolumeX,
  Archive,
  ArchiveRestore,
  Volume2,
  MoreVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MentionTextarea } from "@/components/briefings/MentionTextarea";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoTarefaDetalhe, type TarefaMessageAnexo } from "@/hooks/useProjetoTarefaDetalhe";
import { useTarefaMentionableUsers } from "@/hooks/useTarefaMentionableUsers";
import {
  marcarTarefaChatLida,
  useTarefaChatPreferencia,
  useTarefasChat,
} from "@/hooks/chat/useTarefasChat";
import { resolveMentionsFromText } from "@/lib/briefings/resolveMentions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { initials } from "./utils";
import { detectFileKind } from "@/lib/utils/detectFileKind";

interface Props {
  tarefaId: string;
}

export function TarefaChatPanel({ tarefaId }: Props) {
  const { user } = useAuth();
  const { data: tarefas = [] } = useTarefasChat();
  const tarefa = useMemo(
    () => tarefas.find((t) => t.tarefa_id === tarefaId) ?? null,
    [tarefas, tarefaId],
  );

  const { messages, sendMessage, uploadAnexo, getAnexoUrl } = useProjetoTarefaDetalhe(tarefaId);
  const { data: mencionaveis = [] } = useTarefaMentionableUsers(tarefaId);
  const prefMutation = useTarefaChatPreferencia();

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Marca lido sempre que a tarefa abrir ou chegar mensagem nova.
  useEffect(() => {
    if (!tarefaId) return;
    marcarTarefaChatLida(tarefaId).catch(() => {
      /* silencioso */
    });
  }, [tarefaId, messages.length]);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const goTarefa = () => {
    if (!tarefa) return;
    const qs = new URLSearchParams({ tarefa: tarefaId });
    window.location.assign(
      `/dashboard/projetos/${tarefa.projeto_id}?${qs.toString()}`,
    );
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      const mentionMembers = (mencionaveis ?? []).map((m) => ({
        user_id: m.id,
        nome: m.nome,
      }));
      const mentions = resolveMentionsFromText(t, mentionMembers);
      await sendMessage.mutateAsync({ conteudo: t, mentions });
      setTexto("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar a mensagem");
    } finally {
      setEnviando(false);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { id } = await uploadAnexo.mutateAsync(file);
      const legenda = texto.trim();
      const mentionMembers = (mencionaveis ?? []).map((m) => ({ user_id: m.id, nome: m.nome }));
      const mentions = legenda ? resolveMentionsFromText(legenda, mentionMembers) : [];
      await sendMessage.mutateAsync({
        conteudo: legenda || file.name,
        mentions,
        anexoId: id,
      });
      setTexto("");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar anexo");
    } finally {
      setUploading(false);
    }
  };

  const togglePref = (key: "muted" | "archived") => {
    if (!tarefa) return;
    prefMutation.mutate({ tarefaId, [key]: !(tarefa as any)[key] } as any);
  };

  const corProjeto = tarefa?.projeto_cor ?? "#6366f1";

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border flex items-start gap-3 bg-card">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${corProjeto}1A`,
            boxShadow: `inset 0 0 0 1px ${corProjeto}40`,
          }}
        >
          {tarefa?.is_subtask ? (
            <GitBranch className="h-5 w-5" style={{ color: corProjeto }} />
          ) : (
            <CheckSquare className="h-5 w-5" style={{ color: corProjeto }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {tarefa?.codigo && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {tarefa.codigo}
              </span>
            )}
            <h2 className="text-base font-semibold tracking-tight truncate">
              {tarefa?.titulo ?? "Tarefa"}
            </h2>
            {tarefa?.is_subtask && (
              <Badge variant="outline" className="text-[10px]">
                Subtarefa
              </Badge>
            )}
            {tarefa?.status && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {tarefa.status}
              </Badge>
            )}
            {tarefa?.muted && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <VolumeX className="h-3 w-3" /> silenciada
              </Badge>
            )}
            {tarefa?.archived && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Archive className="h-3 w-3" /> arquivada
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate">{tarefa?.projeto_nome ?? ""}</span>
            {tarefa?.parent_titulo && (
              <>
                <span>›</span>
                <span className="truncate">{tarefa.parent_titulo}</span>
              </>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => togglePref("muted")}>
              {tarefa?.muted ? (
                <><Volume2 className="h-4 w-4 mr-2" />Reativar notificações</>
              ) : (
                <><VolumeX className="h-4 w-4 mr-2" />Silenciar conversa</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => togglePref("archived")}>
              {tarefa?.archived ? (
                <><ArchiveRestore className="h-4 w-4 mr-2" />Restaurar conversa</>
              ) : (
                <><Archive className="h-4 w-4 mr-2" />Arquivar conversa</>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="outline"
          onClick={goTarefa}
          className="gap-1.5 shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir tarefa
        </Button>
      </header>

      {/* Mensagens */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma mensagem nesta tarefa ainda.</p>
              <p className="text-xs">Use o campo abaixo para começar.</p>
            </div>
          )}
          {messages.map((m) => {
            const isMe = m.user_id === user?.id;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2",
                  isMe ? "flex-row-reverse" : "flex-row",
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {m.autor?.avatar_url && (
                    <AvatarImage src={m.autor.avatar_url} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {initials(m.autor?.nome, null)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm space-y-1.5",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm",
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] mb-0.5 opacity-80",
                      isMe ? "text-right" : "",
                    )}
                  >
                    {m.autor?.nome ?? "Usuário"} ·{" "}
                    {formatDistanceToNow(new Date(m.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </div>
                  {m.conteudo && (
                    <div className="whitespace-pre-wrap break-words">
                      {m.conteudo}
                    </div>
                  )}
                  {m.anexo && (
                    <AnexoCard
                      anexo={m.anexo}
                      getUrl={getAnexoUrl}
                      onOpenInTask={() => {
                        if (!tarefa) return;
                        const qs = new URLSearchParams({
                          tarefa: tarefaId,
                          anexo: m.anexo!.id,
                        });
                        window.location.assign(
                          `/dashboard/projetos/${tarefa.projeto_id}?${qs.toString()}`,
                        );
                      }}
                      ownVariant={isMe}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border bg-card p-3">
        <div className="rounded-xl border border-border bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-colors p-2">
          <MentionTextarea
            value={texto}
            onChange={setTexto}
            onSubmitShortcut={enviar}
            members={(mencionaveis ?? []).map((m) => ({
              user_id: m.id,
              nome: m.nome,
              avatar_url: m.avatar_url,
            }))}
            placeholder="Mensagem nesta tarefa… digite @ para marcar alguém"
            rows={2}
            className="resize-none border-0 focus-visible:ring-0 shadow-none px-1.5 py-1 min-h-0 text-sm"
          />
          <div className="flex items-center justify-between mt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePickFile}
              disabled={uploading}
              className="gap-1.5"
              title="Anexar arquivo"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
              Anexar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileSelected}
            />
            <Button
              size="sm"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
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

/**
 * AnexoCard — renderiza o anexo dentro da mensagem.
 * - Imagem: preview inline (lazy) com signed URL.
 * - Outros formatos: card com ícone, nome, tamanho e botão de download.
 * Sempre exibe um link "Ver na tarefa" abrindo o detalhe com o anexo selecionado.
 */
function AnexoCard({
  anexo,
  getUrl,
  onOpenInTask,
  ownVariant,
}: {
  anexo: TarefaMessageAnexo;
  getUrl: (path: string) => Promise<string | undefined>;
  onOpenInTask: () => void;
  ownVariant: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = detectFileKind(anexo.nome, anexo.tipo_arquivo) === "image";

  useEffect(() => {
    let cancel = false;
    if (!isImage) return;
    getUrl(anexo.storage_path).then((u) => {
      if (!cancel && u) setUrl(u);
    });
    return () => {
      cancel = true;
    };
  }, [anexo.storage_path, isImage, getUrl]);

  const handleDownload = async () => {
    const u = await getUrl(anexo.storage_path);
    if (!u) return;
    const a = document.createElement("a");
    a.href = u;
    a.download = anexo.nome;
    a.rel = "noopener noreferrer";
    a.click();
  };

  const sizeKb = anexo.tamanho ? (anexo.tamanho / 1024).toFixed(0) : null;

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border",
        ownVariant
          ? "border-primary-foreground/30 bg-primary-foreground/10"
          : "border-border bg-background",
      )}
    >
      {isImage && url ? (
        <button
          type="button"
          onClick={onOpenInTask}
          className="block w-full max-w-[260px]"
        >
          <img
            src={url}
            alt={anexo.nome}
            loading="lazy"
            className="w-full h-auto max-h-[220px] object-cover"
          />
        </button>
      ) : (
        <div className="flex items-center gap-2 p-2">
          <FileText className="h-5 w-5 shrink-0 opacity-70" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{anexo.nome}</div>
            {sizeKb && (
              <div className="text-[10px] opacity-70">{sizeKb} KB</div>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleDownload}
            title="Baixar"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenInTask}
        className={cn(
          "w-full text-left px-2 py-1 text-[10px] flex items-center gap-1 border-t",
          ownVariant
            ? "border-primary-foreground/20 hover:bg-primary-foreground/10"
            : "border-border hover:bg-muted",
        )}
      >
        <ExternalLink className="h-3 w-3" /> Ver na tarefa
      </button>
    </div>
  );
}
