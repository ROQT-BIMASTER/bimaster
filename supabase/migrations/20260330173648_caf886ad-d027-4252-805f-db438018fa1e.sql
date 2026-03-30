
-- 1. Remove public SELECT policies that expose PII
DROP POLICY IF EXISTS "Anyone can view answers of active forms" ON public.dynamic_form_answers;
DROP POLICY IF EXISTS "Anyone can view responses of active forms" ON public.dynamic_form_responses;

-- 2. Create a security definer function that returns ONLY aggregated stats (no PII)
CREATE OR REPLACE FUNCTION public.get_form_public_stats(p_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_form_status text;
BEGIN
  -- Only allow for active forms
  SELECT status INTO v_form_status FROM dynamic_forms WHERE id = p_form_id;
  IF v_form_status IS NULL OR v_form_status != 'active' THEN
    RETURN jsonb_build_object('error', 'Form not found or inactive');
  END IF;

  SELECT jsonb_build_object(
    'total_responses', (SELECT count(*) FROM dynamic_form_responses WHERE form_id = p_form_id),
    'responses_today', (SELECT count(*) FROM dynamic_form_responses WHERE form_id = p_form_id AND created_at::date = CURRENT_DATE),
    'responses_by_day', (
      SELECT coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb)
      FROM (
        SELECT created_at::date as date, count(*) as count
        FROM dynamic_form_responses
        WHERE form_id = p_form_id
        GROUP BY created_at::date
        ORDER BY created_at::date DESC
        LIMIT 30
      ) d
    ),
    'field_distributions', (
      SELECT coalesce(jsonb_object_agg(ff.id::text, (
        SELECT coalesce(jsonb_agg(row_to_json(dist)), '[]'::jsonb)
        FROM (
          SELECT fa.value as label, count(*) as count
          FROM dynamic_form_answers fa
          JOIN dynamic_form_responses fr ON fr.id = fa.response_id
          WHERE fa.field_id = ff.id AND fr.form_id = p_form_id
          GROUP BY fa.value
          ORDER BY count(*) DESC
          LIMIT 20
        ) dist
      )), '{}'::jsonb)
      FROM dynamic_form_fields ff
      WHERE ff.form_id = p_form_id
        AND ff.field_type IN ('select', 'radio', 'checkbox', 'rating')
    ),
    'fields', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', ff.id,
        'label', ff.label,
        'field_type', ff.field_type,
        'order_index', ff.order_index
      ) ORDER BY ff.order_index), '[]'::jsonb)
      FROM dynamic_form_fields ff
      WHERE ff.form_id = p_form_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_form_public_stats(uuid) TO anon, authenticated;

-- 3. Add authenticated-only SELECT policies (for admin dashboard that needs raw data)
CREATE POLICY "Authenticated can view answers of active forms"
  ON public.dynamic_form_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dynamic_form_responses r
      JOIN dynamic_forms f ON f.id = r.form_id
      WHERE r.id = dynamic_form_answers.response_id AND f.status = 'active'
    )
  );

CREATE POLICY "Authenticated can view responses of active forms"
  ON public.dynamic_form_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dynamic_forms
      WHERE dynamic_forms.id = dynamic_form_responses.form_id AND dynamic_forms.status = 'active'
    )
  );

-- 4. Harden storage policies - Add user ownership where feasible
-- For upload policies, ensure the uploader's uid is in the path
-- Drop overly broad INSERT policies and recreate with path-based ownership

-- department-expense-docs: scope to user's own uploads
DROP POLICY IF EXISTS "Allow authenticated users to upload department expense docs" ON storage.objects;
CREATE POLICY "Auth users upload department-expense-docs own path"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'department-expense-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Allow authenticated users to delete department expense docs" ON storage.objects;
CREATE POLICY "Auth users delete own department-expense-docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'department-expense-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Allow authenticated users to update department expense docs" ON storage.objects;
CREATE POLICY "Auth users update own department-expense-docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'department-expense-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- event-expense-docs: scope write/delete to user's own uploads
DROP POLICY IF EXISTS "Authenticated users can upload expense docs" ON storage.objects;
CREATE POLICY "Auth users upload own event-expense-docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-expense-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can delete expense docs" ON storage.objects;
CREATE POLICY "Auth users delete own event-expense-docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-expense-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- attachments: scope write/delete to own path
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Auth users upload own attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
CREATE POLICY "Auth users delete own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
