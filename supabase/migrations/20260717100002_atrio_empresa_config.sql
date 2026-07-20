-- Fase 1/3: Tabela de configuração Atrio por empresa + RPC de incremento atômico
--
-- Decisão de design: tabela separada (não erp_config) porque erp_config tem UNIQUE(config_key)
-- global — impossível ter linhas por empresa com a mesma chave sem quebrar o constraint existente.

CREATE TABLE IF NOT EXISTS public.atrio_empresa_config (
  empresa_id          INTEGER PRIMARY KEY REFERENCES public.empresas(id),
  numero_sequencia    BIGINT  NOT NULL DEFAULT 0,    -- contador atômico para tipo "9"
  access_token        TEXT    NOT NULL DEFAULT '',
  token_expires_at    TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  historico_id_default INTEGER,
  portador_id_default  INTEGER,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.atrio_empresa_config ENABLE ROW LEVEL SECURITY;

-- Apenas admins lêem (contém access_token); edge functions usam service_role (bypass RLS)
CREATE POLICY "atrio_config_admin_only" ON public.atrio_empresa_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed: uma linha por empresa (empresas 1–11 do grupo)
INSERT INTO public.atrio_empresa_config (empresa_id, numero_sequencia)
SELECT id, 0
FROM public.empresas
WHERE id BETWEEN 1 AND 11
ON CONFLICT (empresa_id) DO NOTHING;

-- RPC: incremento atômico do número sequencial por empresa
-- UPDATE...RETURNING é atômico no PostgreSQL — dois lançamentos simultâneos nunca pegam o mesmo número
CREATE OR REPLACE FUNCTION public.increment_atrio_numero(p_empresa_id integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero bigint;
BEGIN
  UPDATE public.atrio_empresa_config
  SET    numero_sequencia = numero_sequencia + 1,
         updated_at       = now()
  WHERE  empresa_id = p_empresa_id
  RETURNING numero_sequencia INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'atrio_empresa_config não encontrada para empresa_id=%', p_empresa_id;
  END IF;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_atrio_numero(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_atrio_numero(integer) TO service_role;
