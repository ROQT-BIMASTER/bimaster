-- Criar tabela de log de acessos do portal do cliente
CREATE TABLE IF NOT EXISTS public.portal_cliente_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  detalhes JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.portal_cliente_logs ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ver logs
CREATE POLICY "Admins podem ver logs do portal"
ON public.portal_cliente_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política: sistema pode inserir logs
CREATE POLICY "Sistema pode inserir logs"
ON public.portal_cliente_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Função para registrar acesso do cliente
CREATE OR REPLACE FUNCTION public.registrar_acesso_portal(
  p_acao TEXT,
  p_detalhes JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO portal_cliente_logs (user_id, acao, detalhes)
  VALUES (auth.uid(), p_acao, p_detalhes)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;