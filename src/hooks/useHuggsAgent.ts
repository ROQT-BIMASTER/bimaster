import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HuggsMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  contentType: 'text' | 'markdown' | 'html' | 'chart' | 'report' | 'image';
  toolCalls?: any;
  toolResults?: any;
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: string;
}

export interface HuggsSession {
  id: string;
  title: string;
  status: 'active' | 'closed' | 'archived';
  department?: string;
  messagesCount: number;
  lastMessageAt?: string;
  createdAt: string;
}

export interface HuggsAgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  n8nWorkflowId: string;
  n8nWebhookUrl: string;
  isActive: boolean;
  capabilities: string[];
}

interface UseHuggsAgentReturn {
  // State
  messages: HuggsMessage[];
  sessions: HuggsSession[];
  currentSession: HuggsSession | null;
  config: HuggsAgentConfig | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  startNewSession: (department?: string) => Promise<string | null>;
  loadSession: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
  stopStreaming: () => void;
  loadConfig: () => Promise<void>;
  updateConfig: (updates: Partial<HuggsAgentConfig>) => Promise<void>;
  submitFeedback: (messageId: string, rating: number, feedbackType?: string, comment?: string) => Promise<void>;
}

export function useHuggsAgent(): UseHuggsAgentReturn {
  const { toast } = useToast();
  const [messages, setMessages] = useState<HuggsMessage[]>([]);
  const [sessions, setSessions] = useState<HuggsSession[]>([]);
  const [currentSession, setCurrentSession] = useState<HuggsSession | null>(null);
  const [config, setConfig] = useState<HuggsAgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load agent config
  const loadConfig = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('huggs_agent_config')
        .select('*')
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setConfig({
          id: data.id,
          name: data.name,
          description: data.description || '',
          systemPrompt: data.system_prompt || '',
          model: data.model || 'gpt-4.1-mini',
          temperature: data.temperature || 0.7,
          maxTokens: data.max_tokens || 4000,
          n8nWorkflowId: data.n8n_workflow_id || '',
          n8nWebhookUrl: data.n8n_webhook_url || '',
          isActive: data.is_active ?? true,
          capabilities: (data.capabilities as string[]) || []
        });
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error: fetchError } = await supabase
        .from('huggs_chat_sessions')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setSessions((data || []).map(s => ({
        id: s.id,
        title: s.title || 'Nova Conversa',
        status: s.status as 'active' | 'closed' | 'archived',
        department: s.department || undefined,
        messagesCount: s.messages_count || 0,
        lastMessageAt: s.last_message_at || undefined,
        createdAt: s.created_at
      })));
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  }, []);

  // Start new session
  const startNewSession = useCallback(async (department?: string): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
        return null;
      }

      const { data, error: insertError } = await supabase
        .from('huggs_chat_sessions')
        .insert({
          user_id: userData.user.id,
          title: 'Nova Conversa',
          department,
          status: 'active'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const session: HuggsSession = {
        id: data.id,
        title: data.title,
        status: data.status as 'active',
        department: data.department || undefined,
        messagesCount: 0,
        createdAt: data.created_at
      };

      setCurrentSession(session);
      setMessages([]);
      setSessions(prev => [session, ...prev]);

      return data.id;
    } catch (err) {
      console.error('Error starting session:', err);
      toast({ title: 'Erro', description: 'Falha ao iniciar sessão', variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Load session messages
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('huggs_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      setCurrentSession({
        id: sessionData.id,
        title: sessionData.title || 'Nova Conversa',
        status: sessionData.status as 'active' | 'closed' | 'archived',
        department: sessionData.department || undefined,
        messagesCount: sessionData.messages_count || 0,
        lastMessageAt: sessionData.last_message_at || undefined,
        createdAt: sessionData.created_at
      });

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('huggs_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      setMessages((messagesData || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
        contentType: (m.content_type || 'text') as 'text' | 'markdown' | 'html' | 'chart' | 'report' | 'image',
        toolCalls: m.tool_calls,
        toolResults: m.tool_results,
        tokensUsed: m.tokens_used || undefined,
        latencyMs: m.latency_ms || undefined,
        createdAt: m.created_at
      })));
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Falha ao carregar sessão');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send message via n8n workflow
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession) {
      toast({ title: 'Erro', description: 'Nenhuma sessão ativa', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setIsStreaming(true);
    setError(null);

    const startTime = Date.now();
    abortControllerRef.current = new AbortController();

    // Add user message immediately
    const userMessage: HuggsMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      contentType: 'text',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Save user message to database
      await supabase.from('huggs_chat_messages').insert({
        session_id: currentSession.id,
        role: 'user',
        content,
        content_type: 'text'
      });

      // Prepare conversation history
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call the edge function that integrates with n8n
      const { data, error: funcError } = await supabase.functions.invoke('huggs-agent-chat', {
        body: {
          sessionId: currentSession.id,
          message: content,
          history: conversationHistory,
          department: currentSession.department
        }
      });

      if (funcError) throw funcError;

      const latencyMs = Date.now() - startTime;

      // Add assistant response
      const assistantMessage: HuggsMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.content || 'Desculpe, não consegui processar sua solicitação.',
        contentType: data.contentType || 'markdown',
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
        tokensUsed: data.tokensUsed,
        latencyMs,
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to database
      await supabase.from('huggs_chat_messages').insert({
        session_id: currentSession.id,
        role: 'assistant',
        content: assistantMessage.content,
        content_type: assistantMessage.contentType,
        tool_calls: assistantMessage.toolCalls,
        tool_results: assistantMessage.toolResults,
        tokens_used: assistantMessage.tokensUsed,
        latency_ms: latencyMs
      });

      // Update session title if first message
      if (messages.length === 0) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        await supabase.from('huggs_chat_sessions')
          .update({ title })
          .eq('id', currentSession.id);
        
        setCurrentSession(prev => prev ? { ...prev, title } : null);
        setSessions(prev => prev.map(s => 
          s.id === currentSession.id ? { ...s, title } : s
        ));
      }

      // Log usage
      await supabase.from('huggs_usage_logs').insert({
        session_id: currentSession.id,
        action: 'chat_message',
        tokens_input: data.tokensInput || 0,
        tokens_output: data.tokensOutput || 0,
        latency_ms: latencyMs,
        tool_used: data.toolUsed || null,
        success: true
      });

    } catch (err: any) {
      console.error('Error sending message:', err);
      
      const errorMessage = err.message || 'Falha ao enviar mensagem';
      setError(errorMessage);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Erro: ${errorMessage}. Por favor, tente novamente.`,
        contentType: 'text',
        createdAt: new Date().toISOString()
      }]);

      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });

      // Log error
      await supabase.from('huggs_usage_logs').insert({
        session_id: currentSession.id,
        action: 'chat_message',
        success: false,
        error_message: errorMessage
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [currentSession, messages, toast]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  // Archive session
  const archiveSession = useCallback(async (sessionId: string) => {
    try {
      await supabase
        .from('huggs_chat_sessions')
        .update({ status: 'archived' })
        .eq('id', sessionId);

      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, status: 'archived' as const } : s
      ));

      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }

      toast({ title: 'Sucesso', description: 'Sessão arquivada' });
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao arquivar sessão', variant: 'destructive' });
    }
  }, [currentSession, toast]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentSession(null);
  }, []);

  // Update config
  const updateConfig = useCallback(async (updates: Partial<HuggsAgentConfig>) => {
    if (!config) return;

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.systemPrompt !== undefined) dbUpdates.system_prompt = updates.systemPrompt;
      if (updates.model !== undefined) dbUpdates.model = updates.model;
      if (updates.temperature !== undefined) dbUpdates.temperature = updates.temperature;
      if (updates.maxTokens !== undefined) dbUpdates.max_tokens = updates.maxTokens;
      if (updates.n8nWorkflowId !== undefined) dbUpdates.n8n_workflow_id = updates.n8nWorkflowId;
      if (updates.n8nWebhookUrl !== undefined) dbUpdates.n8n_webhook_url = updates.n8nWebhookUrl;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.capabilities !== undefined) dbUpdates.capabilities = updates.capabilities;

      await supabase
        .from('huggs_agent_config')
        .update(dbUpdates)
        .eq('id', config.id);

      setConfig(prev => prev ? { ...prev, ...updates } : null);
      toast({ title: 'Sucesso', description: 'Configuração atualizada' });
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao atualizar configuração', variant: 'destructive' });
    }
  }, [config, toast]);

  // Submit feedback
  const submitFeedback = useCallback(async (
    messageId: string, 
    rating: number, 
    feedbackType?: string, 
    comment?: string
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      await supabase.from('huggs_feedback').insert({
        message_id: messageId,
        user_id: userData.user.id,
        rating,
        feedback_type: feedbackType,
        comment
      });

      toast({ title: 'Obrigado!', description: 'Seu feedback foi registrado' });
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  }, [toast]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadSessions();
  }, [loadConfig, loadSessions]);

  return {
    messages,
    sessions,
    currentSession,
    config,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    startNewSession,
    loadSession,
    loadSessions,
    archiveSession,
    clearMessages,
    stopStreaming,
    loadConfig,
    updateConfig,
    submitFeedback
  };
}
