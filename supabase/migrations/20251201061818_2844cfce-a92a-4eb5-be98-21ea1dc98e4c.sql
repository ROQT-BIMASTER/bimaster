
-- Fix security definer functions by setting search_path = public

-- Fix update_tabela_preco_updated_at
CREATE OR REPLACE FUNCTION update_tabela_preco_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_social_accounts_updated_at
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_social_media_posts_updated_at
CREATE OR REPLACE FUNCTION update_social_media_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_whatsapp_conversations_updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix calcular_custo_mod_op
CREATE OR REPLACE FUNCTION calcular_custo_mod_op(
  _quantidade_produzida numeric,
  _tempo_producao_minutos numeric,
  _custo_hora_mao_obra numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tempo_producao_minutos = 0 OR _tempo_producao_minutos IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN (_tempo_producao_minutos / 60.0) * _custo_hora_mao_obra;
END;
$$;

-- Fix calcular_duracao_timesheet
CREATE OR REPLACE FUNCTION calcular_duracao_timesheet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hora_fim IS NOT NULL AND NEW.hora_inicio IS NOT NULL THEN
    NEW.duracao_minutos := EXTRACT(EPOCH FROM (NEW.hora_fim - NEW.hora_inicio)) / 60;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix calcular_duracao_parada
CREATE OR REPLACE FUNCTION calcular_duracao_parada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hora_fim IS NOT NULL AND NEW.hora_inicio IS NOT NULL THEN
    NEW.duracao_minutos := EXTRACT(EPOCH FROM (NEW.hora_fim - NEW.hora_inicio)) / 60;
  END IF;
  RETURN NEW;
END;
$$;
