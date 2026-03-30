
-- Formularios dinamicos
CREATE TABLE public.dynamic_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  company_id INTEGER REFERENCES public.empresas(id),
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campos do formulario
CREATE TABLE public.dynamic_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN DEFAULT false,
  options JSONB DEFAULT '[]',
  placeholder TEXT,
  validation JSONB DEFAULT '{}',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Respostas (uma por preenchimento)
CREATE TABLE public.dynamic_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.dynamic_forms(id) ON DELETE CASCADE NOT NULL,
  token_id UUID,
  user_id UUID REFERENCES auth.users(id),
  client_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Respostas individuais por campo
CREATE TABLE public.dynamic_form_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.dynamic_form_responses(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES public.dynamic_form_fields(id) ON DELETE CASCADE NOT NULL,
  value JSONB NOT NULL
);

-- RLS
ALTER TABLE public.dynamic_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_answers ENABLE ROW LEVEL SECURITY;

-- Policies for dynamic_forms
CREATE POLICY "Users can view their own forms" ON public.dynamic_forms
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create forms" ON public.dynamic_forms
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own forms" ON public.dynamic_forms
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own forms" ON public.dynamic_forms
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Policies for dynamic_form_fields (follow parent form)
CREATE POLICY "Users can view fields of their forms" ON public.dynamic_form_fields
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dynamic_forms WHERE id = form_id AND created_by = auth.uid()));

CREATE POLICY "Users can manage fields of their forms" ON public.dynamic_form_fields
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dynamic_forms WHERE id = form_id AND created_by = auth.uid()));

-- Policies for dynamic_form_responses (public insert for form filling)
CREATE POLICY "Anyone can submit responses" ON public.dynamic_form_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Form owners can view responses" ON public.dynamic_form_responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dynamic_forms WHERE id = form_id AND created_by = auth.uid()));

-- Policies for dynamic_form_answers
CREATE POLICY "Anyone can submit answers" ON public.dynamic_form_answers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Form owners can view answers" ON public.dynamic_form_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dynamic_form_responses r
    JOIN public.dynamic_forms f ON f.id = r.form_id
    WHERE r.id = response_id AND f.created_by = auth.uid()
  ));

-- Public read for active forms (for public form filling)
CREATE POLICY "Anyone can view active forms" ON public.dynamic_forms
  FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY "Anyone can view fields of active forms" ON public.dynamic_form_fields
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.dynamic_forms WHERE id = form_id AND status = 'active'));
