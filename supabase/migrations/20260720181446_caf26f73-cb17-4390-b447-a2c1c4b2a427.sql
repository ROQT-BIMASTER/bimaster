-- ============================================================
-- 20260717100000_atrio_contas_pagar_columns.sql
-- ============================================================
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS atrio_tipo        TEXT,
  ADD COLUMN IF NOT EXISTS atrio_numero      BIGINT,
  ADD COLUMN IF NOT EXISTS atrio_sequencia   INTEGER,
  ADD COLUMN IF NOT EXISTS atrio_fornecedor_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_atrio_key
  ON public.contas_pagar (empresa_id, atrio_tipo, atrio_numero, atrio_sequencia)
  WHERE atrio_numero IS NOT NULL;

-- ============================================================
-- 20260717100001_atrio_contas_receber_columns.sql
-- ============================================================
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS atrio_tipo        INTEGER,
  ADD COLUMN IF NOT EXISTS atrio_numero      BIGINT,
  ADD COLUMN IF NOT EXISTS atrio_sequencia   INTEGER,
  ADD COLUMN IF NOT EXISTS atrio_cliente_id  BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cr_atrio_key
  ON public.contas_receber (empresa_id, atrio_tipo, atrio_numero, atrio_sequencia)
  WHERE atrio_numero IS NOT NULL;

-- ============================================================
-- 20260717100002_atrio_empresa_config.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atrio_empresa_config (
  empresa_id          INTEGER PRIMARY KEY REFERENCES public.empresas(id),
  numero_sequencia    BIGINT  NOT NULL DEFAULT 0,
  access_token        TEXT    NOT NULL DEFAULT '',
  token_expires_at    TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  historico_id_default INTEGER,
  portador_id_default  INTEGER,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atrio_empresa_config TO authenticated;
GRANT ALL ON public.atrio_empresa_config TO service_role;

ALTER TABLE public.atrio_empresa_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atrio_config_admin_only" ON public.atrio_empresa_config;
CREATE POLICY "atrio_config_admin_only" ON public.atrio_empresa_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.atrio_empresa_config (empresa_id, numero_sequencia)
SELECT id, 0
FROM public.empresas
WHERE id BETWEEN 1 AND 11
ON CONFLICT (empresa_id) DO NOTHING;

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

-- ============================================================
-- 20260717100003_atrio_situacao_sincronizado_em.sql
-- ============================================================
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS atrio_situacao       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS atrio_sincronizado_em TIMESTAMPTZ;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS atrio_sincronizado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cp_atrio_sincronizado_em
  ON public.contas_pagar (atrio_sincronizado_em)
  WHERE atrio_sincronizado_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cr_atrio_sincronizado_em
  ON public.contas_receber (atrio_sincronizado_em)
  WHERE atrio_sincronizado_em IS NOT NULL;