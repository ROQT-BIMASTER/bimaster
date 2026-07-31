import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionInput } from "../MentionInput";
import { MessageCircle, X, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ChatAnexoCard } from "../chat/ChatAnexoCard";
import { ChatComposerActionsBar } from "@/components/chat/v2/ChatComposerActionsBar";
import { useAbrirAcaoVinculada } from "@/hooks/chat/useAbrirAcaoVinculada";
import { TarefaAcoesHistoricoResumo } from "./TarefaAcoesHistoricoResumo";
import type { TarefaMessageAnexo } from "@/hooks/useProjetoTarefaDetalhe";

interface Message {
  id: string;
  conteudo: string;
  user_id: string;
  created_at: string;
  mentions?: string[];
  anexo_id?: string | null;
  anexo?: TarefaMessageAnexo | null;
  autor?: { nome: string; avatar_url: string | null } | null;
}

interface TeamMember {
  id: string;
  nome: string;
  avatar_url: string | null;
}

function renderMentionText(text: string) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

interface TarefaChatPanelProps {
  messages: Message[];
  sendMessage: {
    mutate: (data: { conteudo: string; mentions: string[]; anexoId?: string | null }) => void;
    mutateAsync?: (data: { conteudo: string; mentions: string[]; anexoId?: string | null }) => Promise<unknown>;
  };
  teamMembers: TeamMember[];
  /** @deprecated mantido por compatibilidade — use `currentUserId` para alinhar a bolha. */
  criadorId?: string | null;
  currentUserId?: string | null;
  onClose: () => void;

  // ----- Anexos no chat (auto-save na tarefa + promover ao Cofre) -----
  uploadAnexo?: {
    mutateAsync: (file: File) => Promise<{ id: string; nome: string }>;
  };
  getAnexoUrl?: (storage_path: string) => Promise<string>;
  sendToCofre?: {
    mutateAsync: (args: {
      anexoIds: string[];
      produtoId: string;
      categoriasPorAnexo: Record<string, string>;
      projetoId?: string;
    }) => Promise<unknown>;
    isPending?: boolean;
  };
  canPromoteToCofre?: boolean;
  produtoId?: string | null;
  projetoId?: string | null;
  onOpenAnexoInTask?: (anexoId: string) => void;
  /** Identificação da tarefa para ações vinculadas (aprovação / chamar atenção). */
  tarefaId?: string | null;
  tarefaTitulo?: string | null;
}

export function TarefaChatPanel({
  messages,
  sendMessage,
  teamMembers,
  criadorId,
  currentUserId,
  onClose,
  uploadAnexo,
  getAnexoUrl,
  sendToCofre,
  canPromoteToCofre = false,
  produtoId,
  projetoId,
  onOpenAnexoInTask,
  tarefaId,
  tarefaTitulo,
}: TarefaChatPanelProps) {
  const meId = currentUserId ?? criadorId ?? null;
  const [chatValue, setChatValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { abrirAprovacao, abrirUrgente } = useAbrirAcaoVinculada();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatSubmit = (text: string, mentionIds: string[]) => {
    sendMessage.mutate({ conteudo: text, mentions: mentionIds });
    setChatValue("");
  };

  const enviarArquivo = async (file?: File | null) => {
    if (!file || !uploadAnexo) return;
    setUploading(true);
    try {
      const { id } = await uploadAnexo.mutateAsync(file);
      const legenda = chatValue.trim();
      if (sendMessage.mutateAsync) {
        await sendMessage.mutateAsync({
          conteudo: legenda || file.name,
          mentions: [],
          anexoId: id,
        });
      } else {
        sendMessage.mutate({
          conteudo: legenda || file.name,
          mentions: [],
          anexoId: id,
        });
      }
      setChatValue("");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar anexo no chat.");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="w-[260px] flex flex-col bg-muted/10">
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Chat
        </h4>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <TarefaAcoesHistoricoResumo tarefaId={tarefaId} />
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem ainda.</p>
          )}
          {messages.map(m => {
            const isMe = !!meId && m.user_id === meId;
            return (
              <div key={m.id} className={cn("flex gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
                <Avatar className="h-5 w-5 flex-shrink-0">
                  <AvatarImage src={m.autor?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                    {m.autor?.nome?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs space-y-1",
                  isMe ? "bg-primary/20 text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  <p className="font-medium text-[10px] mb-0.5">{m.autor?.nome?.split(" ")[0]}</p>
                  {m.conteudo && (
                    <p className="whitespace-pre-wrap">{renderMentionText(m.conteudo)}</p>
                  )}
                  {m.anexo && getAnexoUrl && (
                    <ChatAnexoCard
                      anexo={m.anexo}
                      getUrl={getAnexoUrl as any}
                      ownVariant={isMe}
                      compact
                      canPromoteToCofre={canPromoteToCofre}
                      produtoId={produtoId}
                      projetoId={projetoId}
                      sendToCofre={sendToCofre}
                      onOpenInTask={onOpenAnexoInTask ? () => onOpenAnexoInTask(m.anexo!.id) : undefined}
                    />
                  )}
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>
      <div className="p-2 border-t border-border/50 space-y-1.5">
        <MentionInput
          value={chatValue}
          onChange={setChatValue}
          onSubmit={handleChatSubmit}
          users={teamMembers}
          placeholder="Mensagem..."
          minRows={1}
        />
        <div className="flex items-center justify-between">
          <ChatComposerActionsBar
            onAttachFile={(files) => enviarArquivo(files[0])}
            onCameraCapture={(f) => enviarArquivo(f)}
            onRequestApproval={() =>
              abrirAprovacao({ tipo: "tarefa", refId: tarefaId ?? "", titulo: tarefaTitulo ?? "Tarefa" })
            }
            onUrgentAlert={() =>
              abrirUrgente({ tipo: "tarefa", refId: tarefaId ?? "", titulo: tarefaTitulo ?? "Tarefa" })
            }
            onEmojiPick={(emoji) => setChatValue((v) => v + emoji)}
            disabled={uploading || !uploadAnexo}
          />
          {uploading ? (
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Enviando…
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground">Auto-salva na tarefa</span>
          )}
        </div>
      </div>
    </div>
  );
}
