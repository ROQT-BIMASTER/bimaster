-- Criar tabela de conversas
CREATE TABLE public.conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'privada' CHECK (tipo IN ('privada', 'grupo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de participantes das conversas
CREATE TABLE public.conversas_participantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_leitura TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversa_id, usuario_id)
);

-- Criar tabela de mensagens
CREATE TABLE public.mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas para conversas
CREATE POLICY "Usuários podem ver suas próprias conversas"
ON public.conversas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = conversas.id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem criar conversas"
ON public.conversas FOR INSERT
WITH CHECK (true);

-- Políticas para participantes
CREATE POLICY "Usuários podem ver participantes de suas conversas"
ON public.conversas_participantes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = conversas_participantes.conversa_id 
    AND cp.usuario_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem adicionar participantes"
ON public.conversas_participantes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar sua própria participação"
ON public.conversas_participantes FOR UPDATE
USING (usuario_id = auth.uid());

-- Políticas para mensagens
CREATE POLICY "Usuários podem ver mensagens de suas conversas"
ON public.mensagens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = mensagens.conversa_id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem enviar mensagens em suas conversas"
ON public.mensagens FOR INSERT
WITH CHECK (
  remetente_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = mensagens.conversa_id AND usuario_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar mensagens que enviaram"
ON public.mensagens FOR UPDATE
USING (remetente_id = auth.uid());

-- Trigger para atualizar timestamp da conversa
CREATE OR REPLACE FUNCTION public.update_conversa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversas
  SET updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversa_timestamp
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.update_conversa_timestamp();

-- Habilitar realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;