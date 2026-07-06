
-- 1) Coluna protocolo
ALTER TABLE public.chat_aprovacoes
  ADD COLUMN IF NOT EXISTS protocolo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS chat_aprovacoes_protocolo_uk
  ON public.chat_aprovacoes (protocolo)
  WHERE protocolo IS NOT NULL;

-- 2) Contador por ano
CREATE TABLE IF NOT EXISTS public.chat_aprovacoes_protocolo_seq (
  ano INT PRIMARY KEY,
  ultimo BIGINT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.chat_aprovacoes_protocolo_seq TO authenticated;
GRANT ALL ON public.chat_aprovacoes_protocolo_seq TO service_role;
ALTER TABLE public.chat_aprovacoes_protocolo_seq ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso apenas via trigger SECURITY DEFINER.

-- 3) Função + trigger
CREATE OR REPLACE FUNCTION public.tg_chat_aprovacao_gerar_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INT;
  v_num BIGINT;
BEGIN
  IF NEW.protocolo IS NOT NULL AND NEW.protocolo <> '' THEN
    RETURN NEW;
  END IF;
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::INT;

  INSERT INTO public.chat_aprovacoes_protocolo_seq (ano, ultimo)
    VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo = public.chat_aprovacoes_protocolo_seq.ultimo + 1
  RETURNING ultimo INTO v_num;

  NEW.protocolo := 'APR-' || v_ano::TEXT || '-' || LPAD(v_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_chat_aprovacao_gerar_protocolo ON public.chat_aprovacoes;
CREATE TRIGGER tg_chat_aprovacao_gerar_protocolo
  BEFORE INSERT ON public.chat_aprovacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_chat_aprovacao_gerar_protocolo();

-- 4) Backfill de registros existentes (mantém ordem cronológica por ano)
DO $$
DECLARE
  r RECORD;
  v_ano INT;
  v_num BIGINT;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM public.chat_aprovacoes
    WHERE protocolo IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    v_ano := EXTRACT(YEAR FROM r.created_at)::INT;
    INSERT INTO public.chat_aprovacoes_protocolo_seq (ano, ultimo)
      VALUES (v_ano, 1)
    ON CONFLICT (ano) DO UPDATE
      SET ultimo = public.chat_aprovacoes_protocolo_seq.ultimo + 1
    RETURNING ultimo INTO v_num;

    UPDATE public.chat_aprovacoes
      SET protocolo = 'APR-' || v_ano::TEXT || '-' || LPAD(v_num::TEXT, 6, '0')
      WHERE id = r.id;
  END LOOP;
END $$;
