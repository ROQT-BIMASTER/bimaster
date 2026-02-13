import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Mic, MicOff, Send, Volume2, VolumeX, Bot, User, Loader2, 
  Sparkles, AlertCircle, X, MessageCircle, Phone, PhoneOff,
  FileText, Lightbulb, Scale, TrendingUp, Wrench, BarChart3, Search,
  Download, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthHeaders } from "@/lib/utils/auth-headers";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { exportToExcel } from "@/utils/excelExport";
import { supabase } from "@/integrations/supabase/client";

interface ChartPayload {
  type: "bar" | "line" | "pie" | "area";
  title: string;
  data: any[];
  xKey: string;
  yKeys: string[];
  colors: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioBase64?: string;
  timestamp: Date;
  toolsUsed?: string[];
  charts?: ChartPayload[];
}

interface SofiaFloatingChatProps {
  contasData?: any[];
}

const TOOL_LABELS: Record<string, { label: string; icon: typeof Search }> = {
  buscar_contas_vencidas: { label: "Contas vencidas", icon: AlertCircle },
  buscar_contas_por_fornecedor: { label: "Fornecedor", icon: Search },
  resumo_fluxo_caixa: { label: "Fluxo de caixa", icon: TrendingUp },
  analise_aging: { label: "Aging", icon: BarChart3 },
  top_fornecedores_gastos: { label: "Top fornecedores", icon: BarChart3 },
  gerar_relatorio_executivo: { label: "Relatório", icon: FileText },
  gerar_dados_grafico: { label: "Gráfico", icon: BarChart3 },
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function SofiaChart({ chart, messageId }: { chart: ChartPayload; messageId: string }) {
  const chartRef = useRef<HTMLDivElement>(null);

  const downloadPNG = async () => {
    if (!chartRef.current) return;
    try {
      const svg = chartRef.current.querySelector("svg");
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx!.fillStyle = "#ffffff";
          ctx!.fillRect(0, 0, canvas.width, canvas.height);
          ctx!.scale(2, 2);
          ctx!.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `sofia-${chart.title.replace(/\s+/g, "-").toLowerCase()}.png`;
              a.click();
              URL.revokeObjectURL(a.href);
            }
            resolve();
          }, "image/png");
          URL.revokeObjectURL(url);
        };
        img.onerror = reject;
        img.src = url;
      });

      toast.success("Gráfico baixado como PNG!");
    } catch {
      toast.error("Erro ao exportar gráfico");
    }
  };

  const downloadExcel = async () => {
    try {
      const columns = Object.keys(chart.data[0] || {}).map((key) => ({
        header: key.charAt(0).toUpperCase() + key.slice(1),
        key,
        width: 20,
      }));
      await exportToExcel(chart.data, {
        filename: `sofia-${chart.title.replace(/\s+/g, "-").toLowerCase()}`,
        sheetName: chart.title.substring(0, 31),
        columns,
        includeTimestamp: true,
      });
      toast.success("Dados exportados para Excel!");
    } catch {
      toast.error("Erro ao exportar dados");
    }
  };

  const renderChart = () => {
    const { type, data, xKey, yKeys, colors } = chart;

    const customTooltip = ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null;
      return (
        <div className="bg-background border rounded-md shadow-lg p-2 text-xs">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }}>
              {p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}
            </p>
          ))}
        </div>
      );
    };

    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xKey} tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              {yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />
              ))}
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xKey} tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              {yKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey={xKey} tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              {yKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.2} strokeWidth={2} />
              ))}
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            </AreaChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ strokeWidth: 1 }}
                fontSize={9}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={customTooltip} />
            </PieChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="mt-2 bg-background rounded-lg border p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold">{chart.title}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadPNG} title="Baixar PNG">
            <ImageIcon className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadExcel} title="Baixar Excel">
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div ref={chartRef}>
        {renderChart()}
      </div>
    </div>
  );
}

export function SofiaFloatingChat({ contasData = [] }: SofiaFloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
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
      if (audioRef.current) audioRef.current.pause();
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
          }),
        }
      );

      if (response.status === 429) {
        toast.error("IA temporariamente indisponível. Aguarde um momento.");
        throw new Error("Rate limited");
      }
      if (response.status === 402) {
        toast.error("Créditos de IA esgotados.");
        throw new Error("Payment required");
      }

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
        toolsUsed: data.toolsUsed,
        charts: data.charts?.length ? data.charts : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.audioBase64 && voiceEnabled) {
        await playAudio(data.audioBase64);
      }
    } catch (error) {
      console.error("Erro no chat:", error);
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

  const quickActions = [
    { icon: AlertCircle, text: "Qual a situação das contas vencidas?", color: "text-red-500" },
    { icon: TrendingUp, text: "Como está o fluxo de caixa dos próximos 30 dias?", color: "text-blue-500" },
    { icon: BarChart3, text: "Gere um gráfico de aging das contas vencidas", color: "text-amber-500" },
    { icon: FileText, text: "Gere um relatório executivo financeiro completo", color: "text-green-500" },
    { icon: BarChart3, text: "Gráfico dos top 10 fornecedores por gastos", color: "text-purple-500" },
    { icon: Scale, text: "Gráfico de evolução mensal do fluxo de caixa", color: "text-yellow-500" },
  ];

  return (
    <>
      {/* Floating button */}
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
              </div>
            </Button>
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

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[480px] h-[700px] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden"
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
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-white/20 text-white border-0">
                        PRO
                      </Badge>
                    </h3>
                    <p className="text-xs opacity-80">IA Financeira • Gráficos • Relatórios</p>
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
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-3">
                    <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <h3 className="font-medium mb-1">Olá! Sou a Sofia 👋</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      IA avançada com gráficos interativos, relatórios e análise de todo o histórico financeiro.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickActions.map((q, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSend(q.text)}
                          className="justify-start gap-1.5 text-[11px] h-8 px-2"
                          disabled={isLoading}
                        >
                          <q.icon className={`h-3.5 w-3.5 shrink-0 ${q.color}`} />
                          <span className="truncate text-left">{q.text}</span>
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
                      <Avatar className="h-7 w-7 bg-primary/10 shrink-0 mt-1">
                        <AvatarFallback className="bg-transparent">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`max-w-[88%] space-y-1`}>
                      {/* Tool badges */}
                      {message.role === "assistant" && message.toolsUsed?.length ? (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {message.toolsUsed.map((tool, i) => {
                            const info = TOOL_LABELS[tool];
                            return (
                              <Badge key={i} variant="outline" className="text-[9px] gap-1 py-0 px-1.5 bg-primary/5">
                                <Wrench className="h-2.5 w-2.5" />
                                {info?.label || tool}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : null}

                      <div
                        className={`rounded-lg px-3 py-2 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/50 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        
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

                      {/* Charts */}
                      {message.charts?.map((chart, i) => (
                        <SofiaChart key={`${message.id}-chart-${i}`} chart={chart} messageId={message.id} />
                      ))}
                    </div>

                    {message.role === "user" && (
                      <Avatar className="h-7 w-7 bg-secondary shrink-0 mt-1">
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
                        <span className="text-xs text-muted-foreground">Consultando dados e analisando...</span>
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
                  onKeyDown={handleKeyPress}
                  placeholder={isListening ? "Ouvindo..." : "Peça gráficos, relatórios, análises..."}
                  disabled={isLoading || isListening}
                  className="flex-1 h-9 text-sm"
                />
                
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0 h-9 w-9"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
