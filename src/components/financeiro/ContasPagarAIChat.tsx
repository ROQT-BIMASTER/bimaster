import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Bot, User, Loader2, 
  MessageCircle, Sparkles, AlertCircle, Calendar, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioBase64?: string;
  timestamp: Date;
}

interface ChatContext {
  totalVencido: number;
  totalVencendoHoje: number;
  qtdVencidas: number;
  qtdVencendoHoje: number;
}

export function ContasPagarAIChat() {
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

  // Auto-scroll quando novas mensagens chegam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Configurar Speech Recognition
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
        // Enviar automaticamente
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
      
      // Usar data URI diretamente
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
      };
      
      audio.onerror = (e) => {
        console.error("Erro ao reproduzir áudio:", e);
        setIsSpeaking(false);
      };
      
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
      toast.error("Reconhecimento de voz não suportado neste navegador");
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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contas-pagar-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            message: text,
            history,
            generateAudio: voiceEnabled,
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
      };

      setMessages(prev => [...prev, assistantMessage]);
      setContext(data.context);

      // Reproduzir áudio automaticamente se disponível
      if (data.audioBase64 && voiceEnabled) {
        await playAudio(data.audioBase64);
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      toast.error("Erro ao processar mensagem");
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    { icon: AlertCircle, text: "Qual a situação das contas vencidas?" },
    { icon: Calendar, text: "O que vence hoje?" },
    { icon: DollarSign, text: "Qual o total a pagar este mês?" },
  ];

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10 bg-gradient-to-br from-primary to-primary/60">
                <AvatarFallback className="bg-transparent text-primary-foreground">
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
              <CardTitle className="text-base flex items-center gap-2">
                Sofia - IA Financeira
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Especialista em Contas a Pagar
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={voiceEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (isSpeaking) stopAudio();
                setVoiceEnabled(!voiceEnabled);
              }}
              className="gap-1"
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Voz</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" />
                  <span className="hidden sm:inline">Mudo</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Badges de contexto */}
        {context && (
          <div className="flex flex-wrap gap-2 mt-3">
            {context.qtdVencidas > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {context.qtdVencidas} vencidas
              </Badge>
            )}
            {context.qtdVencendoHoje > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Calendar className="h-3 w-3" />
                {context.qtdVencendoHoje} hoje
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">Olá! Sou a Sofia 👋</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Posso ajudar você a entender a situação das contas a pagar. 
                Faça uma pergunta ou use os atalhos abaixo!
              </p>
              
              <div className="flex flex-wrap justify-center gap-2">
                {quickQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSend(q.text)}
                    className="gap-2"
                    disabled={isLoading}
                  >
                    <q.icon className="h-4 w-4" />
                    {q.text}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 bg-primary/10 shrink-0">
                  <AvatarFallback className="bg-transparent">
                    <Bot className="h-4 w-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
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
                    className="mt-2 h-7 text-xs gap-1"
                    onClick={() => {
                      if (isSpeaking) {
                        stopAudio();
                      } else {
                        playAudio(message.audioBase64!);
                      }
                    }}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="h-3 w-3" />
                        Parar
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        Ouvir
                      </>
                    )}
                  </Button>
                )}
                
                <p className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {message.role === "user" && (
                <Avatar className="h-8 w-8 bg-secondary shrink-0">
                  <AvatarFallback className="bg-transparent">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 bg-primary/10 shrink-0">
                <AvatarFallback className="bg-transparent">
                  <Bot className="h-4 w-4 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Pensando...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={toggleListening}
            disabled={isLoading}
            className="shrink-0"
            title={isListening ? "Parar de ouvir" : "Falar"}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isListening ? "Ouvindo..." : "Digite sua pergunta..."}
            disabled={isLoading || isListening}
            className="flex-1"
          />
          
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center mt-2">
          {voiceEnabled ? "🔊 Respostas serão faladas" : "🔇 Modo silencioso"}
          {isListening && " • 🎤 Ouvindo..."}
        </p>
      </div>
    </Card>
  );
}
