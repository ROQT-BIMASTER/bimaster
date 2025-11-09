-- Tabela para armazenar conversas ativas do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para histórico de mensagens
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para vincular números de telefone aos usuários
CREATE TABLE IF NOT EXISTS public.user_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  phone_number TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user ON public.whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_phone ON public.user_whatsapp(phone_number);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_whatsapp ENABLE ROW LEVEL SECURITY;

-- RLS Policies para whatsapp_conversations
CREATE POLICY "Usuários veem suas próprias conversas" 
  ON public.whatsapp_conversations 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Sistema pode inserir conversas" 
  ON public.whatsapp_conversations 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar conversas" 
  ON public.whatsapp_conversations 
  FOR UPDATE 
  USING (true);

-- RLS Policies para whatsapp_messages
CREATE POLICY "Usuários veem mensagens de suas conversas" 
  ON public.whatsapp_messages 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema pode inserir mensagens" 
  ON public.whatsapp_messages 
  FOR INSERT 
  WITH CHECK (true);

-- RLS Policies para user_whatsapp
CREATE POLICY "Usuários veem seu próprio vínculo" 
  ON public.user_whatsapp 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar vínculo" 
  ON public.user_whatsapp 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seu vínculo" 
  ON public.user_whatsapp 
  FOR UPDATE 
  USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_conversations_updated_at();