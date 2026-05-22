
CREATE OR REPLACE FUNCTION public.rpc_crm_search(
  _empresa_id integer,
  _q text,
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  kind text,
  id uuid,
  conversa_id uuid,
  titulo text,
  subtitulo text,
  trecho text,
  rank real,
  quando timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH q AS (
    SELECT
      NULLIF(btrim(_q), '') AS raw,
      CASE WHEN NULLIF(btrim(_q), '') IS NULL THEN NULL
           ELSE websearch_to_tsquery('portuguese', btrim(_q))
      END AS tsq,
      LEAST(GREATEST(COALESCE(_limit, 20), 1), 50) AS lim
  ),
  contatos AS (
    SELECT
      'contato'::text AS kind,
      c.id,
      NULL::uuid AS conversa_id,
      COALESCE(c.nome, c.telefone, c.email, 'Sem nome') AS titulo,
      COALESCE(c.telefone, c.email, '') AS subtitulo,
      NULL::text AS trecho,
      GREATEST(
        extensions.similarity(COALESCE(c.nome, ''),     (SELECT raw FROM q)),
        extensions.similarity(COALESCE(c.telefone, ''), (SELECT raw FROM q)),
        extensions.similarity(COALESCE(c.email, ''),    (SELECT raw FROM q))
      ) AS rank,
      c.ultimo_contato_em AS quando
    FROM public.crm_contatos c, q
    WHERE c.empresa_id = _empresa_id
      AND q.raw IS NOT NULL
      AND (
        c.nome     ILIKE '%' || q.raw || '%'
        OR c.telefone ILIKE '%' || q.raw || '%'
        OR c.email    ILIKE '%' || q.raw || '%'
      )
    ORDER BY rank DESC NULLS LAST, c.ultimo_contato_em DESC NULLS LAST
    LIMIT 50
  ),
  mensagens AS (
    SELECT
      'mensagem'::text AS kind,
      m.id,
      m.conversa_id,
      COALESCE(ct.nome, ct.telefone, 'Conversa') AS titulo,
      to_char(m.criada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS subtitulo,
      ts_headline(
        'portuguese',
        LEFT(COALESCE(m.conteudo, ''), 400),
        (SELECT tsq FROM q),
        'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=18,MinWords=4'
      ) AS trecho,
      ts_rank(m.content_tsv, (SELECT tsq FROM q)) AS rank,
      m.criada_em AS quando
    FROM public.crm_mensagens m
    JOIN public.crm_conversas cv ON cv.id = m.conversa_id
    LEFT JOIN public.crm_contatos ct ON ct.id = cv.contato_id
    , q
    WHERE m.empresa_id = _empresa_id
      AND q.tsq IS NOT NULL
      AND m.content_tsv @@ (SELECT tsq FROM q)
    ORDER BY rank DESC, m.criada_em DESC
    LIMIT 50
  )
  SELECT * FROM contatos
  UNION ALL
  SELECT * FROM mensagens
  ORDER BY rank DESC NULLS LAST, quando DESC NULLS LAST
  LIMIT (SELECT lim FROM q);
$$;

CREATE TABLE IF NOT EXISTS public.crm_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  flag text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, flag)
);

ALTER TABLE public.crm_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_flags_select_own_empresa" ON public.crm_feature_flags;
CREATE POLICY "crm_flags_select_own_empresa"
  ON public.crm_feature_flags
  FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "crm_flags_admin_all" ON public.crm_feature_flags;
CREATE POLICY "crm_flags_admin_all"
  ON public.crm_feature_flags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_crm_flags_updated ON public.crm_feature_flags;
CREATE TRIGGER trg_crm_flags_updated
BEFORE UPDATE ON public.crm_feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
