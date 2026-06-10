
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.copilot_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  copilot_id    text NOT NULL,
  source_type   text NOT NULL,
  source_ref    text NOT NULL,
  title         text,
  content       text NOT NULL,
  acl_scope     jsonb NOT NULL DEFAULT '{}'::jsonb,
  language      text NOT NULL DEFAULT 'pt',
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at   timestamptz,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_documents_copilot_idx ON public.copilot_documents(copilot_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS copilot_documents_source_idx  ON public.copilot_documents(source_type, source_ref);
CREATE INDEX IF NOT EXISTS copilot_documents_acl_gin     ON public.copilot_documents USING gin(acl_scope);

GRANT SELECT ON public.copilot_documents TO authenticated;
GRANT ALL    ON public.copilot_documents TO service_role;
ALTER TABLE public.copilot_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_documents_owner_read"
  ON public.copilot_documents FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.copilot_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.copilot_documents(id) ON DELETE CASCADE,
  chunk_index   int  NOT NULL,
  text          text NOT NULL,
  embedding     halfvec(3072) NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS copilot_chunks_doc_idx ON public.copilot_chunks(document_id);
CREATE INDEX IF NOT EXISTS copilot_chunks_hnsw   ON public.copilot_chunks USING hnsw (embedding halfvec_cosine_ops);

GRANT SELECT ON public.copilot_chunks TO authenticated;
GRANT ALL    ON public.copilot_chunks TO service_role;
ALTER TABLE public.copilot_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_chunks_deny_all"
  ON public.copilot_chunks FOR SELECT
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.match_copilot_chunks(
  query_embedding halfvec(3072),
  match_count     int    DEFAULT 20,
  p_copilot_id    text   DEFAULT NULL,
  p_user_id       uuid   DEFAULT NULL,
  p_filters       jsonb  DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  chunk_id  uuid,
  doc_id    uuid,
  text      text,
  score     float,
  metadata  jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id            AS chunk_id,
    c.document_id   AS doc_id,
    c.text,
    1 - (c.embedding <=> query_embedding) AS score,
    c.metadata
  FROM public.copilot_chunks c
  JOIN public.copilot_documents d ON d.id = c.document_id
  WHERE d.archived_at IS NULL
    AND (p_copilot_id IS NULL OR d.copilot_id = p_copilot_id)
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 100));
$$;

REVOKE ALL ON FUNCTION public.match_copilot_chunks(halfvec, int, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_copilot_chunks(halfvec, int, text, uuid, jsonb) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.copilot_proposals (
  proposal_id      text PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name        text NOT NULL,
  args_hash        text NOT NULL,
  client_action_id text,
  preview          jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_step_up boolean NOT NULL DEFAULT false,
  scope_key        text,
  category         text NOT NULL,
  expires_at       timestamptz NOT NULL,
  consumed_at      timestamptz,
  audit_id         uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_proposals_user_idx    ON public.copilot_proposals(user_id);
CREATE INDEX IF NOT EXISTS copilot_proposals_expires_idx ON public.copilot_proposals(expires_at);

GRANT SELECT, INSERT, UPDATE ON public.copilot_proposals TO authenticated;
GRANT ALL ON public.copilot_proposals TO service_role;
ALTER TABLE public.copilot_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_proposals_owner_rw"
  ON public.copilot_proposals FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.copilot_index_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.copilot_documents(id) ON DELETE CASCADE,
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('hot','normal')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  attempts    int  NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_index_queue_pick_idx
  ON public.copilot_index_queue(status, priority DESC, created_at);

GRANT ALL ON public.copilot_index_queue TO service_role;
ALTER TABLE public.copilot_index_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.copilot_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            text NOT NULL,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  copilot_id            text NOT NULL,
  model                 text NOT NULL,
  routed_complexity     text NOT NULL CHECK (routed_complexity IN ('simple','complex')),
  classifier_confidence numeric,
  tool_calls            jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations_count       int NOT NULL DEFAULT 0,
  unverifiable_numbers  int NOT NULL DEFAULT 0,
  rag_breach_blocked    int NOT NULL DEFAULT 0,
  tokens_prompt         int,
  tokens_completion     int,
  latency_ms            int,
  error_code            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_runs_user_idx    ON public.copilot_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS copilot_runs_copilot_idx ON public.copilot_runs(copilot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS copilot_runs_request_idx ON public.copilot_runs(request_id);

GRANT SELECT ON public.copilot_runs TO authenticated;
GRANT ALL ON public.copilot_runs TO service_role;
ALTER TABLE public.copilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_runs_owner_read"
  ON public.copilot_runs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.copilot_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  copilot_id        text NOT NULL,
  tool_name         text NOT NULL,
  proposal_id       text REFERENCES public.copilot_proposals(proposal_id) ON DELETE SET NULL,
  category          text NOT NULL,
  undoable          boolean NOT NULL,
  diff              jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_ref        jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverses_audit_id uuid REFERENCES public.copilot_audit_log(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_audit_log_user_idx ON public.copilot_audit_log(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.copilot_audit_log TO authenticated;
GRANT ALL ON public.copilot_audit_log TO service_role;
ALTER TABLE public.copilot_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_audit_log_owner_read"
  ON public.copilot_audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "copilot_audit_log_insert_self"
  ON public.copilot_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._copilot_audit_log_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'copilot_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS copilot_audit_log_no_update ON public.copilot_audit_log;
CREATE TRIGGER copilot_audit_log_no_update
  BEFORE UPDATE OR DELETE ON public.copilot_audit_log
  FOR EACH ROW EXECUTE FUNCTION public._copilot_audit_log_block_mutations();

CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS copilot_documents_touch ON public.copilot_documents;
CREATE TRIGGER copilot_documents_touch BEFORE UPDATE ON public.copilot_documents
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

DROP TRIGGER IF EXISTS copilot_index_queue_touch ON public.copilot_index_queue;
CREATE TRIGGER copilot_index_queue_touch BEFORE UPDATE ON public.copilot_index_queue
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();
