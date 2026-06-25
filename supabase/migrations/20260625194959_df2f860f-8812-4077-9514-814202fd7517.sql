
-- ============================================================
-- Real-time clientes sync infra (mirrors estoque pattern)
-- ============================================================

-- 1) Raw landing table
CREATE TABLE IF NOT EXISTS public.erp_clientes_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_erp text NOT NULL UNIQUE,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  email text,
  telefone text,
  celular text,
  endereco text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  ibge_codigo integer,
  data_ultima_compra timestamptz,
  valor_ultima_compra numeric(15,2),
  data_maior_compra timestamptz,
  valor_maior_compra numeric(15,2),
  data_cadastro timestamptz,
  inativo boolean DEFAULT false,
  vendedor_codigo integer,
  vendedor_nome text,
  equipe_codigo integer,
  equipe_nome text,
  supervisor text,
  classificacao integer,
  limite_credito numeric(15,2),
  status_bloqueio text,
  raw jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.erp_clientes_raw TO authenticated;
GRANT ALL ON public.erp_clientes_raw TO service_role;

ALTER TABLE public.erp_clientes_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/supervisor pode ler erp_clientes_raw"
ON public.erp_clientes_raw FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'supervisor')
  )
);

CREATE INDEX IF NOT EXISTS idx_erp_clientes_raw_cnpj ON public.erp_clientes_raw (cnpj);
CREATE INDEX IF NOT EXISTS idx_erp_clientes_raw_ibge ON public.erp_clientes_raw (ibge_codigo);
CREATE INDEX IF NOT EXISTS idx_erp_clientes_raw_uf_cidade ON public.erp_clientes_raw (uf, cidade);
CREATE INDEX IF NOT EXISTS idx_erp_clientes_raw_sync ON public.erp_clientes_raw (sincronizado_em DESC);

CREATE TRIGGER update_erp_clientes_raw_updated_at
BEFORE UPDATE ON public.erp_clientes_raw
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Applier RPC: merge raw -> public.clientes preserving manual edits
CREATE OR REPLACE FUNCTION public.aplicar_clientes_rp_no_master()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_resolvidos_ibge integer := 0;
BEGIN
  -- Upsert por codigo (clientes.codigo == erp_clientes_raw.codigo_erp)
  WITH src AS (
    SELECT
      r.codigo_erp,
      r.cnpj,
      COALESCE(NULLIF(TRIM(r.razao_social), ''), 'SEM NOME') AS nome,
      r.nome_fantasia,
      r.email, r.telefone, r.celular,
      r.endereco, r.bairro, r.cidade, r.uf, r.cep,
      r.data_cadastro,
      r.data_ultima_compra, r.valor_ultima_compra,
      r.data_maior_compra,  r.valor_maior_compra,
      r.vendedor_codigo, r.vendedor_nome,
      r.equipe_codigo,   r.equipe_nome,
      r.supervisor,
      r.classificacao,
      r.limite_credito,
      r.status_bloqueio,
      r.ibge_codigo,
      r.inativo,
      -- Resolve ibge_municipio_id: (a) ibge_codigo direto, (b) nome+uf
      COALESCE(
        (SELECT im.id FROM public.ibge_municipios im
         WHERE r.ibge_codigo IS NOT NULL
           AND im.codigo_ibge = r.ibge_codigo LIMIT 1),
        (SELECT im.id FROM public.ibge_municipios im
         WHERE r.cidade IS NOT NULL AND r.uf IS NOT NULL
           AND LOWER(TRIM(public.unaccent(im.nome))) = LOWER(TRIM(public.unaccent(r.cidade)))
           AND im.uf_sigla = r.uf LIMIT 1)
      ) AS ibge_municipio_id
    FROM public.erp_clientes_raw r
  ),
  ups AS (
    INSERT INTO public.clientes AS c (
      codigo, cnpj, nome, nome_abreviado,
      email, telefone, celular,
      endereco, bairro, cidade, uf, cep,
      data_cadastro,
      data_ultima_compra, valor_ultima_compra,
      data_maior_compra,  valor_maior_compra,
      cod_vend, vendedor, cod_equipe, nome_equipe, supervisor,
      classificacao, limite_credito, status_bloqueio,
      ibge_municipio_id, codigo_ibge_municipio,
      sincronizado_em, updated_at
    )
    SELECT
      s.codigo_erp, s.cnpj, s.nome, s.nome_fantasia,
      s.email, s.telefone, s.celular,
      s.endereco, s.bairro, s.cidade, s.uf, s.cep,
      s.data_cadastro,
      s.data_ultima_compra, s.valor_ultima_compra,
      s.data_maior_compra,  s.valor_maior_compra,
      s.vendedor_codigo, s.vendedor_nome, s.equipe_codigo, s.equipe_nome, s.supervisor,
      s.classificacao, s.limite_credito, COALESCE(s.status_bloqueio, 'ativo'),
      s.ibge_municipio_id, s.ibge_codigo,
      now(), now()
    FROM src s
    ON CONFLICT (codigo) DO UPDATE SET
      cnpj                = EXCLUDED.cnpj,
      nome                = EXCLUDED.nome,
      nome_abreviado      = EXCLUDED.nome_abreviado,
      email               = EXCLUDED.email,
      telefone            = EXCLUDED.telefone,
      celular             = EXCLUDED.celular,
      endereco            = EXCLUDED.endereco,
      bairro              = EXCLUDED.bairro,
      cidade              = EXCLUDED.cidade,
      uf                  = EXCLUDED.uf,
      cep                 = EXCLUDED.cep,
      data_cadastro       = COALESCE(EXCLUDED.data_cadastro, c.data_cadastro),
      data_ultima_compra  = EXCLUDED.data_ultima_compra,
      valor_ultima_compra = EXCLUDED.valor_ultima_compra,
      data_maior_compra   = EXCLUDED.data_maior_compra,
      valor_maior_compra  = EXCLUDED.valor_maior_compra,
      cod_vend            = EXCLUDED.cod_vend,
      vendedor            = EXCLUDED.vendedor,
      cod_equipe          = EXCLUDED.cod_equipe,
      nome_equipe         = EXCLUDED.nome_equipe,
      supervisor          = EXCLUDED.supervisor,
      classificacao       = EXCLUDED.classificacao,
      limite_credito      = EXCLUDED.limite_credito,
      status_bloqueio     = EXCLUDED.status_bloqueio,
      ibge_municipio_id   = EXCLUDED.ibge_municipio_id,
      codigo_ibge_municipio = EXCLUDED.codigo_ibge_municipio,
      sincronizado_em     = now(),
      updated_at          = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inseridos, v_atualizados
  FROM ups;

  SELECT COUNT(*) INTO v_resolvidos_ibge
  FROM public.clientes WHERE ibge_municipio_id IS NOT NULL;

  RETURN jsonb_build_object(
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'total_com_ibge', v_resolvidos_ibge,
    'aplicado_em', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_clientes_rp_no_master() TO service_role;

-- 3) Freshness view for UI badge
CREATE OR REPLACE VIEW public.vw_clientes_sync_status
WITH (security_invoker = on) AS
SELECT
  (SELECT MAX(sincronizado_em) FROM public.erp_clientes_raw) AS last_sync_at,
  (SELECT COUNT(*) FROM public.erp_clientes_raw)             AS total_raw,
  (SELECT COUNT(*) FROM public.clientes)                     AS total_master,
  (SELECT MAX(sincronizado_em) FROM public.clientes)         AS last_master_sync_at;

GRANT SELECT ON public.vw_clientes_sync_status TO authenticated;
