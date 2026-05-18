CREATE OR REPLACE FUNCTION public.submit_dynamic_form_response(
  p_form_id uuid,
  p_token_id uuid DEFAULT NULL,
  p_answers jsonb DEFAULT '[]'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response_id uuid := gen_random_uuid();
  v_missing_labels text[];
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  IF p_form_id IS NULL THEN
    RAISE EXCEPTION 'Formulário não especificado' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dynamic_forms f
    WHERE f.id = p_form_id
      AND f.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Formulário não encontrado ou inativo' USING ERRCODE = '22023';
  END IF;

  IF p_token_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.team_form_tokens t
    WHERE t.id = p_token_id
      AND t.status = 'active'
      AND t.expires_at > now()
      AND (t.max_uses IS NULL OR t.use_count < t.max_uses)
  ) THEN
    RAISE EXCEPTION 'Token inválido ou expirado' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(COALESCE(p_answers, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Respostas inválidas' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    WITH raw_answers AS (
      SELECT
        elem,
        elem->>'field_id' AS field_id_text,
        elem->'value' AS value
      FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) AS elem
    )
    SELECT 1
    FROM raw_answers a
    WHERE a.field_id_text IS NULL
       OR a.field_id_text !~* v_uuid_pattern
       OR a.value IS NULL
       OR a.value = 'null'::jsonb
       OR (jsonb_typeof(a.value) = 'string' AND a.value = '""'::jsonb)
       OR (jsonb_typeof(a.value) = 'array' AND jsonb_array_length(a.value) = 0)
       OR NOT EXISTS (
         SELECT 1
         FROM public.dynamic_form_fields ff
         WHERE ff.id = a.field_id_text::uuid
           AND ff.form_id = p_form_id
       )
  ) THEN
    RAISE EXCEPTION 'Respostas inválidas para este formulário' USING ERRCODE = '22023';
  END IF;

  WITH provided_answers AS (
    SELECT elem->>'field_id' AS field_id_text, elem->'value' AS value
    FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) AS elem
  )
  SELECT array_agg(ff.label ORDER BY ff.order_index)
  INTO v_missing_labels
  FROM public.dynamic_form_fields ff
  WHERE ff.form_id = p_form_id
    AND COALESCE(ff.required, false) = true
    AND NOT EXISTS (
      SELECT 1
      FROM provided_answers pa
      WHERE pa.field_id_text ~* v_uuid_pattern
        AND pa.field_id_text::uuid = ff.id
        AND pa.value IS NOT NULL
        AND pa.value <> 'null'::jsonb
        AND NOT (jsonb_typeof(pa.value) = 'string' AND pa.value = '""'::jsonb)
        AND NOT (jsonb_typeof(pa.value) = 'array' AND jsonb_array_length(pa.value) = 0)
    );

  IF array_length(v_missing_labels, 1) > 0 THEN
    RAISE EXCEPTION 'Campos obrigatórios não preenchidos: %', array_to_string(v_missing_labels, ', ') USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.dynamic_form_responses (id, form_id, token_id, user_id, metadata)
  VALUES (
    v_response_id,
    p_form_id,
    p_token_id,
    auth.uid(),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('submitted_at', now())
  );

  INSERT INTO public.dynamic_form_answers (response_id, field_id, value)
  SELECT
    v_response_id,
    (elem->>'field_id')::uuid,
    elem->'value'
  FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) AS elem;

  IF p_token_id IS NOT NULL THEN
    UPDATE public.team_form_tokens
    SET use_count = use_count + 1
    WHERE id = p_token_id;
  END IF;

  RETURN v_response_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_dynamic_form_response(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_dynamic_form_response(uuid, uuid, jsonb, jsonb) TO anon, authenticated;