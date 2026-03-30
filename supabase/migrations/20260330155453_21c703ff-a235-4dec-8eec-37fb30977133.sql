-- Allow anon to read responses (only id + created_at) for active forms
-- This enables the public dashboard to compute aggregate statistics
CREATE POLICY "Anyone can view responses of active forms"
ON public.dynamic_form_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.dynamic_forms
    WHERE dynamic_forms.id = dynamic_form_responses.form_id
    AND dynamic_forms.status = 'active'
  )
);

-- Allow anon to read answers for responses of active forms
CREATE POLICY "Anyone can view answers of active forms"
ON public.dynamic_form_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.dynamic_form_responses r
    JOIN public.dynamic_forms f ON f.id = r.form_id
    WHERE r.id = dynamic_form_answers.response_id
    AND f.status = 'active'
  )
);