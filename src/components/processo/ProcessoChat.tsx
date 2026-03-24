import { useState, useRef, useEffect, useMemo } from "react";
import { useProcessoChat, type ProcessChatMessage } from "@/hooks/useProcessoChat";
import { ProcessoChatDocPicker } from "./ProcessoChatDocPicker";
import { MentionInput } from "@/components/projetos/MentionInput";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, FileText, Stamp, Loader2, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessoChatProps {
  processId: string;
  moduloOrigem: string;
  /** Documents from submission for linking */
  availableDocs?: { id: string; titulo: string; categoria: string }[];
  compact?: boolean;
}

const TIPO_STYLES: Record<string, string> = {
  juntada: "bg-purple-50 dark:bg-purple-950/30 border-l-2 border-l-purple-500",
  decisao: "bg-green-50 dark:bg-green-950/30 border-l-2 border-l-green-500",
  sistema: "bg-muted/50 border-l-2 border-l-muted-foreground",
};

export function ProcessoChat({ processId, moduloOrigem, availableDocs = [], compact }: ProcessoChatProps) {
  const { messages, isLoading, sendMessage, oficializarDocumento, mentionUsers, mentionModulos } = useProcessoChat(processId);
  const [inputValue, setInputValue] = useState("");
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [pendingDocIds, setPendingDocIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Combined mentions (modules + people)
  const allMentions = useMemo(() => [...mentionModulos, ...mentionUsers], [mentionModulos, mentionUsers]);

  const handleSubmit = (text: string, _mentionIds: string[]) => {
    sendMessage.mutate({
      conteudo: text,
      modulo_origem: moduloOrigem,
      documento_ids: pendingDocIds.length > 0 ? pendingDocIds : undefined,
    });
    setPendingDocIds([]);
    setInputValue("");
  };

  const handleVincular = (docIds: string[]) => {
    setPendingDocIds(docIds);
  };

  const handleOficializar = (docId: string, titulo: string, fase: string) => {
    oficializarDocumento.mutate({
      documento_id: docId,
      documento_titulo: titulo,
      fase,
      modulo_origem: moduloOrigem,
    });
  };

  const docMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableDocs.forEach(d => { map[d.id] = d.titulo; });
    return map;
  }, [availableDocs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className={compact ? "h-[200px]" : "h-[300px]"}>
        <div ref={scrollRef} className="p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma mensagem ainda. Inicie a discussão!
            </div>
          ) : (
            messages.map(msg => (
              <ChatMessage key={msg.id} msg={msg} docMap={docMap} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Pending docs indicator */}
      {pendingDocIds.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1 bg-muted/30 border-t text-[10px] text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          {pendingDocIds.length} documento(s) vinculado(s)
          <button className="ml-auto text-destructive hover:underline" onClick={() => setPendingDocIds([])}>
            Remover
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-1 mb-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => setDocPickerOpen(true)}
            disabled={availableDocs.length === 0}
          >
            <Paperclip className="h-3 w-3 mr-1" /> Anexar Doc
          </Button>
          {moduloOrigem && (
            <Badge variant="outline" className="text-[9px] h-5">{moduloOrigem}</Badge>
          )}
        </div>

        <MentionInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          users={allMentions}
          placeholder="Digite uma mensagem... Use @ para mencionar"
          minRows={1}
        />
      </div>

      {/* Doc picker dialog */}
      <ProcessoChatDocPicker
        open={docPickerOpen}
        onClose={() => setDocPickerOpen(false)}
        documents={availableDocs}
        onVincular={handleVincular}
        onOficializar={handleOficializar}
      />
    </div>
  );
}

function ChatMessage({ msg, docMap }: { msg: ProcessChatMessage; docMap: Record<string, string> }) {
  const isSystem = msg.tipo === "sistema" || msg.tipo === "juntada" || msg.tipo === "decisao";
  const style = TIPO_STYLES[msg.tipo] || "";

  return (
    <div className={`flex gap-2 ${style} rounded-md p-2`}>
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
          {msg.user_nome?.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">{msg.user_nome}</span>
          {msg.modulo_origem && (
            <Badge variant="secondary" className="text-[9px] h-4">{msg.modulo_origem}</Badge>
          )}
          {isSystem && (
            <Badge variant="outline" className="text-[9px] h-4">
              {msg.tipo === "juntada" ? <Stamp className="h-2.5 w-2.5 mr-0.5" /> : null}
              {msg.tipo}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </span>
        </div>
        <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">{msg.conteudo}</p>

        {/* Doc chips */}
        {msg.documento_ids && msg.documento_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {msg.documento_ids.map(docId => (
              <Badge key={docId} variant="outline" className="text-[9px] h-5 gap-1">
                <FileText className="h-2.5 w-2.5" />
                {docMap[docId] || docId.substring(0, 8)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
