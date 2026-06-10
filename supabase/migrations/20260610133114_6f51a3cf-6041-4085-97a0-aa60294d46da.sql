CREATE UNIQUE INDEX IF NOT EXISTS copilot_documents_source_uniq
  ON public.copilot_documents (copilot_id, source_type, source_ref)
  WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.enqueue_copilot_document(
  p_copilot_id  text,
  p_source_type text,
  p_source_ref  text,
  p_title       text,
  p_content     text,
  p_acl_scope   jsonb DEFAULT '{}'::jsonb,
  p_metadata    jsonb DEFAULT '{}'::jsonb,
  p_priority    text  DEFAULT 'hot',
  p_created_by  uuid  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_id uuid;
BEGIN
  IF p_copilot_id IS NULL OR p_source_type IS NULL OR p_source_ref IS NULL THEN
    RAISE EXCEPTION 'copilot_id, source_type, source_ref are required';
  END IF;
  IF p_content IS NULL OR length(p_content) = 0 THEN
    RAISE EXCEPTION 'content is required';
  END IF;
  IF p_priority NOT IN ('hot','normal') THEN
    RAISE EXCEPTION 'priority must be hot|normal';
  END IF;

  INSERT INTO public.copilot_documents AS d
    (copilot_id, source_type, source_ref, title, content, acl_scope, metadata, created_by)
  VALUES
    (p_copilot_id, p_source_type, p_source_ref, p_title, p_content,
     COALESCE(p_acl_scope, '{}'::jsonb), COALESCE(p_metadata, '{}'::jsonb), p_created_by)
  ON CONFLICT (copilot_id, source_type, source_ref) WHERE archived_at IS NULL
  DO UPDATE SET
    title      = EXCLUDED.title,
    content    = EXCLUDED.content,
    acl_scope  = EXCLUDED.acl_scope,
    metadata   = d.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING d.id INTO v_doc_id;

  DELETE FROM public.copilot_chunks WHERE document_id = v_doc_id;

  INSERT INTO public.copilot_index_queue (document_id, priority, status)
  VALUES (v_doc_id, p_priority, 'pending')
  ON CONFLICT DO NOTHING;

  RETURN v_doc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_copilot_document(text,text,text,text,text,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_copilot_document(text,text,text,text,text,jsonb,jsonb,text,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_copilot_document(text,text,text,text,text,jsonb,jsonb,text,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_copilot_document(text,text,text,text,text,jsonb,jsonb,text,uuid) TO service_role;