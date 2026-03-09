import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePaymentMessages, type PaymentMessage } from "@/hooks/usePaymentMessages";
import {
  Send, Loader2, MessageCircle, Paperclip, Check, CheckCheck,
  FileText, Mic, MicOff, Square, Play, Pause, Download,
  File, Image, Music, FolderOpen, X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { toast } from "sonner";

interface PaymentChatPanelProps {
  paymentQueueId: string;
  userType: "solicitante" | "financeiro";
  className?: string;
  compact?: boolean;
}

// Audio player for chat bubbles
function AudioPlayer({ url, isRight }: { url: string; isRight: boolean }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    resolveStorageUrl(url).then(({ signedUrl: su }) => {
      if (su) setSignedUrl(su);
    });
  }, [url]);

  const toggle = () => {
    if (!audioRef.current || !signedUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <audio
        ref={audioRef}
        src={signedUrl || ""}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <Button
        size="icon"
        variant="ghost"
        className={cn("h-7 w-7 shrink-0", isRight ? "text-primary-foreground hover:text-primary-foreground/80" : "")}
        onClick={toggle}
        disabled={!signedUrl}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <div className="flex-1 flex items-center gap-1">
        <Music className="h-3 w-3 opacity-60" />
        <span className="text-[10px] opacity-70">Áudio</span>
      </div>
    </div>
  );
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-3 w-3" />;
  if (type.startsWith("audio/")) return <Music className="h-3 w-3" />;
  return <File className="h-3 w-3" />;
}

export function PaymentChatPanel({ paymentQueueId, userType, className, compact = false }: PaymentChatPanelProps) {
  const { messages, isLoading, sendMessage, isSending } = usePaymentMessages(paymentQueueId);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; url: string; type: string; size: number }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const uploadFile = useCallback(async (file: File): Promise<{ name: string; url: string; type: string; size: number } | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const ext = file.name.split(".").pop() || "bin";
    const path = `${userData.user.id}/${paymentQueueId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("payment-chat-files")
      .upload(path, file);

    if (error) {
      toast.error("Erro ao enviar arquivo: " + error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("payment-chat-files")
      .getPublicUrl(path);

    return {
      name: file.name,
      url: urlData.publicUrl,
      type: file.type,
      size: file.size,
    };
  }, [paymentQueueId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setIsUploading(true);
    try {
      const uploaded: typeof pendingFiles = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} excede 20MB`);
          continue;
        }
        const result = await uploadFile(file);
        if (result) uploaded.push(result);
      }
      if (uploaded.length > 0) {
        setPendingFiles(prev => [...prev, ...uploaded]);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        
        setIsUploading(true);
        const result = await uploadFile(file);
        setIsUploading(false);

        if (result) {
          // Send audio as a message immediately
          await sendMessage({
            conteudo: "🎤 Mensagem de áudio",
            tipo: userType,
            anexos: [result],
          });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content && pendingFiles.length === 0) return;
    setNewMessage("");
    const files = [...pendingFiles];
    setPendingFiles([]);
    await sendMessage({ conteudo: content || (files.length > 0 ? "📎 Arquivo(s) enviado(s)" : ""), tipo: userType, anexos: files });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwnMessage = (msg: PaymentMessage) => msg.usuario_id === currentUserId;
  const isFinanceiroMessage = (msg: PaymentMessage) => msg.tipo === "financeiro";

  // Collect all attachments for vault tab
  const allAttachments = messages.flatMap(msg =>
    (msg.anexos || []).map(a => ({
      ...a,
      senderName: msg.usuario_nome,
      sentAt: msg.created_at,
      messageId: msg.id,
    }))
  );

  const handleOpenAttachment = async (url: string) => {
    const { signedUrl, error } = await resolveStorageUrl(url);
    if (error || !signedUrl) {
      toast.error("Erro ao abrir arquivo");
      return;
    }
    window.open(signedUrl, "_blank");
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("flex flex-col border rounded-lg bg-muted/20", compact ? "h-[300px]" : "h-[450px]", className)}>
      <Tabs defaultValue="chat" className="flex flex-col flex-1 overflow-hidden">
        {/* Header with tabs */}
        <div className="border-b bg-card rounded-t-lg px-2">
          <TabsList className="h-9 bg-transparent w-full justify-start gap-1">
            <TabsTrigger value="chat" className="text-xs gap-1.5 data-[state=active]:bg-muted">
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
              {messages.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {messages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vault" className="text-xs gap-1.5 data-[state=active]:bg-muted">
              <FolderOpen className="h-3.5 w-3.5" />
              Documentos
              {allAttachments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {allAttachments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef as any}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
                <MessageCircle className="h-8 w-8 opacity-40" />
                <p className="text-xs">Nenhuma mensagem ainda</p>
                <p className="text-xs opacity-60">Envie mensagens, documentos ou áudios</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isRight = isFinanceiroMessage(msg);
                  const isOwn = isOwnMessage(msg);
                  const readByOthers = (msg.lida_por || []).filter(id => id !== msg.usuario_id).length > 0;

                  return (
                    <div
                      key={msg.id}
                      className={cn("flex flex-col max-w-[80%]", isRight ? "ml-auto items-end" : "items-start")}
                    >
                      <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                        {msg.usuario_nome}
                        {msg.tipo === "financeiro" && (
                          <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-3.5 border-primary/30 text-primary">
                            Financeiro
                          </Badge>
                        )}
                      </span>

                      <div
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm break-words",
                          isRight
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border rounded-bl-sm"
                        )}
                      >
                        {msg.conteudo !== "🎤 Mensagem de áudio" && msg.conteudo !== "📎 Arquivo(s) enviado(s)" && (
                          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                        )}

                        {/* Attachments */}
                        {msg.anexos && msg.anexos.length > 0 && (
                          <div className="mt-1 space-y-1.5">
                            {msg.anexos.map((a, i) => {
                              const isAudio = a.type?.startsWith("audio/");
                              if (isAudio) {
                                return <AudioPlayer key={i} url={a.url} isRight={isRight} />;
                              }
                              return (
                                <button
                                  key={i}
                                  onClick={() => handleOpenAttachment(a.url)}
                                  className={cn(
                                    "flex items-center gap-1.5 text-xs underline cursor-pointer",
                                    isRight ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                                  )}
                                >
                                  {getFileIcon(a.type)}
                                  <span className="truncate max-w-[180px]">{a.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-0.5 px-1">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                        {isOwn && (
                          readByOthers
                            ? <CheckCheck className="h-3 w-3 text-primary" />
                            : <Check className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Pending files preview */}
          {pendingFiles.length > 0 && (
            <div className="border-t px-3 py-2 bg-muted/30 flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                  {getFileIcon(f.type)}
                  <span className="truncate max-w-[100px]">{f.name}</span>
                  <button onClick={() => removePendingFile(i)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-2 flex gap-2 items-end bg-card rounded-b-lg">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={handleFileSelect}
            />

            {isRecording ? (
              <div className="flex-1 flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-2">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-mono text-destructive">{formatTime(recordingTime)}</span>
                <span className="text-xs text-muted-foreground">Gravando...</span>
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={cancelRecording}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="default" className="h-8 w-8 bg-destructive hover:bg-destructive/90" onClick={stopRecording}>
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-9 w-9"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSending}
                  title="Anexar documento"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="resize-none min-h-[36px] text-sm"
                />
                {newMessage.trim() || pendingFiles.length > 0 ? (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={isSending}
                    className="shrink-0 h-9 w-9"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="outline"
                    className="shrink-0 h-9 w-9"
                    onClick={startRecording}
                    title="Gravar áudio"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Vault Tab */}
        <TabsContent value="vault" className="flex-1 flex flex-col overflow-hidden m-0">
          <ScrollArea className="flex-1 px-3 py-2">
            {allAttachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
                <FolderOpen className="h-8 w-8 opacity-40" />
                <p className="text-xs">Nenhum documento trocado</p>
                <p className="text-xs opacity-60">Arquivos e áudios enviados aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allAttachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() => handleOpenAttachment(a.url)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {getFileIcon(a.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.senderName} • {format(new Date(a.sentAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {a.size > 0 && ` • ${(a.size / 1024).toFixed(0)}KB`}
                      </p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
