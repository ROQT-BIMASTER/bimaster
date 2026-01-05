import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface QAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface QAStats {
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  issuesFound: number;
}

export function useQAAgent() {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<QAStats>({
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    issuesFound: 0
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Adiciona mensagem do usuário
    const userMessage: QAMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Cria placeholder para resposta do assistente
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true
    }]);

    try {
      abortControllerRef.current = new AbortController();

      // Prepara histórico de mensagens para a API
      const apiMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      apiMessages.push({ role: "user", content: content.trim() });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit excedido. Aguarde alguns segundos.");
        }
        if (response.status === 402) {
          throw new Error("Créditos insuficientes.");
        }
        throw new Error(`Erro ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Sem resposta do servidor");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: fullContent }
                  : m
              ));
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // Finaliza streaming
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, isStreaming: false }
          : m
      ));

      // Atualiza estatísticas baseado no conteúdo
      const passCount = (fullContent.match(/✅/g) || []).length;
      const failCount = (fullContent.match(/❌/g) || []).length;
      const warnCount = (fullContent.match(/⚠️/g) || []).length;

      if (passCount > 0 || failCount > 0 || warnCount > 0) {
        setStats(prev => ({
          testsRun: prev.testsRun + passCount + failCount + warnCount,
          testsPassed: prev.testsPassed + passCount,
          testsFailed: prev.testsFailed + failCount,
          issuesFound: prev.issuesFound + failCount + warnCount
        }));
      }

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: `❌ Erro: ${errorMessage}`, isStreaming: false }
          : m
      ));

      toast({
        title: "Erro no Agente QA",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, isLoading, toast]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStats({
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      issuesFound: 0
    });
  }, []);

  const quickTest = useCallback((command: string) => {
    sendMessage(command);
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    stats,
    sendMessage,
    stopGeneration,
    clearMessages,
    quickTest
  };
}
