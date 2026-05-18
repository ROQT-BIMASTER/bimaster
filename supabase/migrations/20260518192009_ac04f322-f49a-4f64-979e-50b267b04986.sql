CREATE OR REPLACE FUNCTION public.dynamic_form_answer_insert_allowed(_response_id uuid, _field_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dynamic_form_responses r
    JOIN public.dynamic_forms f ON f.id = r.form_id
    JOIN public.dynamic_form_fields ff ON ff.id = _field_id AND ff.form_id = f.id
    WHERE r.id = _response_id
      AND f.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.dynamic_form_answer_insert_allowed(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dynamic_form_answer_insert_allowed(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can submit answers" ON public.dynamic_form_answers;
CREATE POLICY "Anyone can submit answers"
ON public.dynamic_form_answers
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (public.dynamic_form_answer_insert_allowed(response_id, field_id));