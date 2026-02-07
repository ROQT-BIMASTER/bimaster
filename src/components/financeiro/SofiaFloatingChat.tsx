import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Bot, User, Loader2, 
  Sparkles, AlertCircle, Calendar, DollarSign, X, MessageCircle,
  FileText, Lightbulb, Scale, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthHeaders } from "@/lib/utils/auth-headers";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioBase64?: string;
  timestamp: Date;
  type?: "text" | "pdf" | "advice";
}

interface ChatContext {
  totalVencido: number;
  totalVencendoHoje: number;
  qtdVencidas: number;
  qtdVencendoHoje: number;
}

interface SofiaFloatingChatProps {
  contasData?: any[];
}

export function SofiaFloatingChat({ contasData = [] }: SofiaFloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [context, setContext] = useState<ChatContext | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSend(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Erro de reconhecimento:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Permissão de microfone negada");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      setIsSpeaking(true);
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      
      await audio.play();
    } catch (error) {
      console.error("Erro ao reproduzir áudio:", error);
      setIsSpeaking(false);
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Reconhecimento de voz não suportado");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contas-pagar-ai-chat`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            message: text,
            history,
            generateAudio: voiceEnabled,
            action: detectAction(text),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao processar mensagem");
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        audioBase64: data.audioBase64,
        timestamp: new Date(),
        type: data.type || "text",
      };

      setMessages(prev => [...prev, assistantMessage]);
      setContext(data.context);

      // Reproduzir áudio automaticamente
      if (data.audioBase64 && voiceEnabled) {
        await playAudio(data.audioBase64);
      }

      // Se gerou PDF, abrir em nova aba
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
        toast.success("Relatório PDF gerado com sucesso!");
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      toast.error("Erro ao processar mensagem");
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const detectAction = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('relatório') || lowerText.includes('pdf') || lowerText.includes('gerar')) {
      return 'generate_report';
    }
    if (lowerText.includes('conselho') || lowerText.includes('dica') || lowerText.includes('recomendação') || lowerText.includes('legislação')) {
      return 'advice';
    }
    return 'chat';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { icon: AlertCircle, text: "Qual a situação das contas vencidas?", color: "text-red-500" },
    { icon: FileText, text: "Gerar relatório PDF das contas vencidas", color: "text-blue-500" },
    { icon: Lightbulb, text: "Me dê conselhos para melhorar o fluxo de caixa", color: "text-yellow-500" },
    { icon: Scale, text: "Quais são os prazos legais para pagamento de fornecedores?", color: "text-purple-500" },
  ];

  return (
    <>
      {/* Botão flutuante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <div className="relative">
                <Bot className="h-6 w-6" />
                {context && context.qtdVencidas > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {context.qtdVencidas > 9 ? '9+' : context.qtdVencidas}
                  </span>
                )}
              </div>
            </Button>
            
            {/* Indicador de fala */}
            {isSpeaking && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1"
              >
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat expandido */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10 bg-white/20">
                      <AvatarFallback className="bg-transparent">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    {isSpeaking && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      Sofia <Sparkles className="h-4 w-4 text-yellow-300" />
                    </h3>
                    <p className="text-xs opacity-80">IA Especialista em Contas a Pagar</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (isSpeaking) stopAudio();
                      setVoiceEnabled(!voiceEnabled);
                    }}
                    className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                  >
                    {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Badges de contexto */}
              {context && (
                <div className="flex gap-2 mt-2">
                  {context.qtdVencidas > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {context.qtdVencidas} vencidas
                    </Badge>
                  )}
                  {context.qtdVencendoHoje > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {context.qtdVencendoHoje} hoje
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-4">
                    <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <h3 className="font-medium mb-1">Olá! Sou a Sofia 👋</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Posso gerar relatórios, dar conselhos baseados em legislação e analisar suas contas.
                    </p>
                    
                    <div className="space-y-2">
                      {quickActions.map((q, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSend(q.text)}
                          className="w-full justify-start gap-2 text-xs h-9"
                          disabled={isLoading}
                        >
                          <q.icon className={`h-4 w-4 ${q.color}`} />
                          <span className="truncate">{q.text}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-7 w-7 bg-primary/10 shrink-0">
                        <AvatarFallback className="bg-transparent">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {message.role === "assistant" && message.audioBase64 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 text-[10px] gap-1 px-2"
                          onClick={() => {
                            if (isSpeaking) stopAudio();
                            else playAudio(message.audioBase64!);
                          }}
                        >
                          {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                          {isSpeaking ? "Parar" : "Ouvir"}
                        </Button>
                      )}
                    </div>

                    {message.role === "user" && (
                      <Avatar className="h-7 w-7 bg-secondary shrink-0">
                        <AvatarFallback className="bg-transparent">
                          <User className="h-3.5 w-3.5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <Avatar className="h-7 w-7 bg-primary/10 shrink-0">
                      <AvatarFallback className="bg-transparent">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t bg-muted/30">
              <div className="flex gap-2">
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleListening}
                  disabled={isLoading}
                  className="shrink-0 h-9 w-9"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isListening ? "Ouvindo..." : "Digite ou fale..."}
                  disabled={isLoading || isListening}
                  className="flex-1 h-9 text-sm"
                />
                
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0 h-9 w-9"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                {voiceEnabled ? "🔊 Voz ativa" : "🔇 Mudo"} • Diga "gerar PDF" ou "me dê conselhos"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
