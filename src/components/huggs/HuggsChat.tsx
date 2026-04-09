import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Plus, 
  MessageSquare,
  BarChart3,
  FileText,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sparkles,
  History,
  X
} from 'lucide-react';
import { useHuggsAgent, type HuggsMessage, type HuggsSession } from '@/hooks/useHuggsAgent';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface HuggsChatProps {
  department?: string;
  className?: string;
  embedded?: boolean;
}

export function HuggsChat({ department, className, embedded = false }: HuggsChatProps) {
  const {
    messages,
    sessions,
    currentSession,
    isLoading,
    isStreaming,
    sendMessage,
    startNewSession,
    loadSession,
    loadSessions,
    archiveSession,
    clearMessages,
    stopStreaming,
    submitFeedback
  } = useHuggsAgent();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');

    // Start new session if none exists
    if (!currentSession) {
      await startNewSession(department);
    }

    await sendMessage(message);
  };

  const handleNewChat = async () => {
    await startNewSession(department);
    setShowHistory(false);
  };

  const handleSelectSession = async (session: HuggsSession) => {
    await loadSession(session.id);
    setShowHistory(false);
  };

  const quickActions = [
    { label: 'Relatório de vendas', icon: FileText, prompt: 'Gere um relatório de vendas do último mês' },
    { label: 'Análise por departamento', icon: BarChart3, prompt: 'Analise a performance por departamento' },
    { label: 'Insights gerais', icon: Sparkles, prompt: 'Quais são os principais insights do negócio?' }
  ];

  const renderMessage = (message: HuggsMessage, index: number) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';

    return (
      <div
        key={message.id || index}
        className={cn(
          'flex gap-3 p-4 rounded-lg',
          isUser ? 'bg-muted/50' : 'bg-background'
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          {isUser ? (
            <>
              <AvatarFallback className="bg-primary text-primary-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </>
          ) : (
            <>
              <AvatarImage src="/huggs-avatar.png" />
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </>
          )}
        </Avatar>

        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {isUser ? 'Você' : 'Agente Huggs'}
            </span>
            {message.latencyMs && isAssistant && (
              <Badge variant="outline" className="text-xs">
                {(message.latencyMs / 1000).toFixed(1)}s
              </Badge>
            )}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.contentType === 'markdown' || isAssistant ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {isAssistant && !isStreaming && (
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => submitFeedback(message.id, 5, 'helpful')}
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Útil
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => submitFeedback(message.id, 1, 'not_helpful')}
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Melhorar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('flex flex-col', embedded ? 'border-0 shadow-none' : '', className)}>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Agente Huggs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Assistente de análise de dados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4 mr-1" />
              Histórico
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleNewChat}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Conversa
            </Button>
          </div>
        </div>

        {currentSession && (
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary">
              <MessageSquare className="h-3 w-3 mr-1" />
              {currentSession.title}
            </Badge>
            {currentSession.department && (
              <Badge variant="outline">{currentSession.department}</Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0 relative">
        {/* Session History Sidebar */}
        {showHistory && (
          <div className="absolute inset-y-0 left-0 w-72 bg-background border-r z-10 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">Conversas Anteriores</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sessions.filter(s => s.status !== 'archived').map(session => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg hover:bg-muted transition-colors',
                      currentSession?.id === session.id && 'bg-muted'
                    )}
                  >
                    <p className="font-medium text-sm truncate">{session.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {session.messagesCount} mensagens
                    </p>
                  </button>
                ))}
                {sessions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma conversa anterior
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex flex-col h-[500px]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Olá! Sou o Agente Huggs
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Posso ajudar você a analisar dados da empresa, gerar relatórios e criar visualizações.
                  Como posso ajudar?
                </p>

                <div className="flex flex-wrap gap-2 justify-center">
                  {quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!currentSession) {
                          await startNewSession(department);
                        }
                        await sendMessage(action.prompt);
                      }}
                      disabled={isLoading}
                    >
                      <action.icon className="h-4 w-4 mr-2" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(renderMessage)}
                
                {isStreaming && (
                  <div className="flex items-center gap-2 text-muted-foreground p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Processando...</span>
                    <Button variant="ghost" size="sm" onClick={stopStreaming}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua pergunta..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={!input.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Powered by Bimaster AI
            </p>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
