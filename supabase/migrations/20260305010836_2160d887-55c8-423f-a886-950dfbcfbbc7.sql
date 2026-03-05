
-- Tabela de aceite de termos LGPD
CREATE TABLE public.terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  document_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  UNIQUE(user_id, document_type, document_version)
);

-- RLS
ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Usuário pode ler seus próprios registros
CREATE POLICY "Users can read own terms acceptance"
  ON public.terms_acceptance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuário pode inserir seus próprios registros
CREATE POLICY "Users can insert own terms acceptance"
  ON public.terms_acceptance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin pode ler todos (para ferramenta LGPD)
CREATE POLICY "Admins can read all terms acceptance"
  ON public.terms_acceptance FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
