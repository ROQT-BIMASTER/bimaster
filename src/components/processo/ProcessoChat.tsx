import { useState, useRef, useEffect, useMemo } from "react";
import { useProcessoChat, type ProcessChatMessage } from "@/hooks/useProcessoChat";
import { ProcessoChatDocPicker } from "./ProcessoChatDocPicker";
import { MentionInput } from "@/components/projetos/MentionInput";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Paperclip, FileText, Stamp, Loader2, MessageCircle, Lock, Globe, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { useAuth } from "@/contexts/AuthContext";

interface ProcessoChatProps {
  processId: string;
  moduloOrigem: string;
  availableDocs?: { id: string; titulo: string; categoria: string }[];
  compact?: boolean;
}

const TIPO_STYLES: Record<string, string> = {
  juntada: "bg-purple-50 dark:bg-purple-950/30 border-l-2 border-l-purple-500",
  decisao: "bg-green-50 dark:bg-green-950/30 border-l-2 border-l-green-500",
  sistema: "bg-muted/50 border-l-2 border-l-muted-foreground",
};

type FilterMode = "todas" | "publicas" | "privadas";

export function ProcessoChat({ processId, moduloOrigem, availableDocs = [], compact }: ProcessoChatProps) {
  const { messages, isLoading, sendMessage, oficializarDocumento, mentionUsers, mentionModulos } = useProcessoChat(processId);
  const { user } = useAuth();
  const { data: profiles = [] } = useSystemProfiles();
  const [inputValue, setInputValue] = useState("");
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [pendingDocIds, setPendingDocIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("todas");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const allMentions = useMemo(() => [...mentionModulos, ...mentionUsers], [mentionModulos, mentionUsers]);

  const filteredMessages = useMemo(() => {
    if (filterMode === "todas") return messages;
    if (filterMode === "publicas") return messages.filter(m => m.visibilidade === "publica");
    return messages.filter(m => m.visibilidade === "privada");
  }, [messages, filterMode]);

  const recipientOptions = useMemo(() =>
    profiles.filter(p => p.id !== user?.id),
    [profiles, user?.id]
  );

  const handleSubmit = (text: string, _mentionIds: string[]) => {
    sendMessage.mutate({
      conteudo: text,
      modulo_origem: moduloOrigem,
      documento_ids: pendingDocIds.length > 0 ? pendingDocIds : undefined,
      visibilidade: isPrivate ? "privada" : "publica",
      destinatarios_ids: isPrivate ? selectedRecipients : [],
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

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20">
        {(["todas", "publicas", "privadas"] as FilterMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              filterMode === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {mode === "todas" ? "Todas" : mode === "publicas" ? "Públicas" : "Privadas"}
          </button>
        ))}
      </div>

      {/* Messages */}
      <ScrollArea className={compact ? "h-[200px]" : "h-[300px]"}>
        <div ref={scrollRef} className="p-3 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma mensagem ainda. Inicie a discussão!
            </div>
          ) : (
            filteredMessages.map(msg => (
              <ChatMessage key={msg.id} msg={msg} docMap={docMap} currentUserId={user?.id} />
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

      {/* Private recipients selector */}
      {isPrivate && (
        <div className="px-3 py-2 border-t bg-accent/10 space-y-1.5">
          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Destinatários da mensagem privada:
          </span>
          <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">
            {recipientOptions.map(p => {
              const selected = selectedRecipients.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleRecipient(p.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {p.nome || p.email}
                  {selected && <X className="h-2.5 w-2.5 ml-0.5 inline" />}
                </button>
              );
            })}
          </div>
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
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {isPrivate ? "Privada" : "Pública"}
            </span>
            <Switch
              checked={isPrivate}
              onCheckedChange={(checked) => {
                setIsPrivate(checked);
                if (!checked) setSelectedRecipients([]);
              }}
              className="scale-75"
            />
          </div>
        </div>

        <MentionInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          users={allMentions}
          placeholder={isPrivate ? "Mensagem privada... Use @ para mencionar" : "Digite uma mensagem... Use @ para mencionar"}
          minRows={1}
        />
      </div>

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

function ChatMessage({ msg, docMap, currentUserId }: { msg: ProcessChatMessage; docMap: Record<string, string>; currentUserId?: string }) {
  const isSystem = msg.tipo === "sistema" || msg.tipo === "juntada" || msg.tipo === "decisao";
  const isPrivate = msg.visibilidade === "privada";
  const style = TIPO_STYLES[msg.tipo] || "";
  const privateStyle = isPrivate ? "bg-accent/20 border border-dashed border-accent" : "";

  return (
    <div className={`flex gap-2 ${style} ${privateStyle} rounded-md p-2`}>
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
          {isPrivate && (
            <Badge variant="outline" className="text-[9px] h-4 gap-0.5 border-accent text-accent-foreground">
              <Lock className="h-2.5 w-2.5" /> Privada
            </Badge>
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
