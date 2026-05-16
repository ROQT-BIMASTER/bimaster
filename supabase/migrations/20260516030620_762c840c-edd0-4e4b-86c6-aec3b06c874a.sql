-- Cache global de traduções PT/CN/EN do módulo China
CREATE TABLE IF NOT EXISTS public.china_label_traducoes (
  hash text PRIMARY KEY,
  texto_origem text NOT NULL,
  idioma_origem text NOT NULL CHECK (idioma_origem IN ('pt','cn','en')),
  contexto text,
  label_pt text NOT NULL DEFAULT '',
  label_cn text NOT NULL DEFAULT '',
  label_en text NOT NULL DEFAULT '',
  fonte text NOT NULL DEFAULT 'ai' CHECK (fonte IN ('ai','manual','fallback')),
  modelo_usado text,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_label_traducoes_contexto ON public.china_label_traducoes(contexto);
CREATE INDEX IF NOT EXISTS idx_china_label_traducoes_fonte ON public.china_label_traducoes(fonte);

ALTER TABLE public.china_label_traducoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY china_label_traducoes_select_auth
  ON public.china_label_traducoes FOR SELECT TO authenticated USING (true);

-- Log de auditoria por chamada de tradução
CREATE TABLE IF NOT EXISTS public.china_label_traducao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid,
  entidade text,
  entidade_id text,
  texto_origem text NOT NULL,
  contexto text,
  status text NOT NULL CHECK (status IN ('sucesso','falha','cache_hit','fallback')),
  modelo_usado text,
  payload_resposta jsonb,
  erro_msg text,
  duracao_ms integer,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_label_traducao_log_created_at ON public.china_label_traducao_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_china_label_traducao_log_status ON public.china_label_traducao_log(status);
CREATE INDEX IF NOT EXISTS idx_china_label_traducao_log_submissao ON public.china_label_traducao_log(submissao_id);

ALTER TABLE public.china_label_traducao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY china_label_traducao_log_select_auth
  ON public.china_label_traducao_log FOR SELECT TO authenticated USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public._china_label_traducoes_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_china_label_traducoes_touch ON public.china_label_traducoes;
CREATE TRIGGER trg_china_label_traducoes_touch
  BEFORE UPDATE ON public.china_label_traducoes
  FOR EACH ROW EXECUTE FUNCTION public._china_label_traducoes_touch();

-- RPC: leitura em lote pelo cache (auth: authenticated)
CREATE OR REPLACE FUNCTION public.rpc_translation_cache_get_batch(p_hashes text[])
RETURNS SETOF public.china_label_traducoes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.china_label_traducoes WHERE hash = ANY(p_hashes);
$$;

REVOKE ALL ON FUNCTION public.rpc_translation_cache_get_batch(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_translation_cache_get_batch(text[]) TO authenticated, service_role;

-- RPC: upsert no cache (service_role apenas)
CREATE OR REPLACE FUNCTION public.rpc_translation_cache_put(
  p_hash text,
  p_texto_origem text,
  p_idioma_origem text,
  p_contexto text,
  p_label_pt text,
  p_label_cn text,
  p_label_en text,
  p_fonte text,
  p_modelo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.china_label_traducoes
    (hash, texto_origem, idioma_origem, contexto, label_pt, label_cn, label_en, fonte, modelo_usado, hits)
  VALUES (p_hash, p_texto_origem, COALESCE(p_idioma_origem,'pt'), p_contexto, COALESCE(p_label_pt,''), COALESCE(p_label_cn,''), COALESCE(p_label_en,''), COALESCE(p_fonte,'ai'), p_modelo, 1)
  ON CONFLICT (hash) DO UPDATE SET
    label_pt = CASE WHEN EXCLUDED.label_pt <> '' THEN EXCLUDED.label_pt ELSE public.china_label_traducoes.label_pt END,
    label_cn = CASE WHEN EXCLUDED.label_cn <> '' THEN EXCLUDED.label_cn ELSE public.china_label_traducoes.label_cn END,
    label_en = CASE WHEN EXCLUDED.label_en <> '' THEN EXCLUDED.label_en ELSE public.china_label_traducoes.label_en END,
    fonte = EXCLUDED.fonte,
    modelo_usado = COALESCE(EXCLUDED.modelo_usado, public.china_label_traducoes.modelo_usado),
    hits = public.china_label_traducoes.hits + 1;
END $$;

REVOKE ALL ON FUNCTION public.rpc_translation_cache_put(text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_translation_cache_put(text,text,text,text,text,text,text,text,text) TO service_role;

-- RPC: registro de log (service_role apenas)
CREATE OR REPLACE FUNCTION public.rpc_translation_log_write(
  p_submissao_id uuid,
  p_entidade text,
  p_entidade_id text,
  p_texto_origem text,
  p_contexto text,
  p_status text,
  p_modelo text,
  p_payload jsonb,
  p_erro_msg text,
  p_duracao_ms integer,
  p_user_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.china_label_traducao_log
    (submissao_id, entidade, entidade_id, texto_origem, contexto, status, modelo_usado, payload_resposta, erro_msg, duracao_ms, user_id)
  VALUES (p_submissao_id, p_entidade, p_entidade_id, p_texto_origem, p_contexto, p_status, p_modelo, p_payload, p_erro_msg, p_duracao_ms, p_user_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.rpc_translation_log_write(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_translation_log_write(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid) TO service_role;