
-- Tabela de tokens para formulário compartilhado
CREATE TABLE public.team_form_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  label text NOT NULL,
  equipe_comercial text,
  supervisor_nome text,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_form_tokens ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados (admins/supervisores) podem gerenciar tokens
CREATE POLICY "Authenticated users can view tokens they created"
  ON public.team_form_tokens FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can insert tokens"
  ON public.team_form_tokens FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their tokens"
  ON public.team_form_tokens FOR UPDATE
  USING (auth.uid() = created_by);

-- Tabela de submissions do formulário
CREATE TABLE public.team_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES public.team_form_tokens(id),
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  rg text,
  data_nascimento date,
  email_pessoal text,
  whatsapp text NOT NULL,
  tamanho_camiseta text,
  equipe_comercial text,
  supervisor_nome text,
  observacoes text,
  vinculado boolean NOT NULL DEFAULT false,
  vinculado_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cpf)
);

ALTER TABLE public.team_form_submissions ENABLE ROW LEVEL SECURITY;

-- Admins/supervisores podem ver submissions dos tokens que criaram
CREATE POLICY "Token creators can view submissions"
  ON public.team_form_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_form_tokens t
      WHERE t.id = token_id AND t.created_by = auth.uid()
    )
  );

-- Admins podem atualizar submissions (vincular a user_id)
CREATE POLICY "Token creators can update submissions"
  ON public.team_form_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_form_tokens t
      WHERE t.id = token_id AND t.created_by = auth.uid()
    )
  );
