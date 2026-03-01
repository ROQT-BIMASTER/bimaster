
-- Share tokens for secure WhatsApp document sharing
CREATE TABLE public.cofre_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  produto_id UUID NOT NULL,
  produto_nome TEXT,
  document_ids UUID[] NOT NULL,
  lote_nome TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  access_count INT NOT NULL DEFAULT 0,
  max_access INT NOT NULL DEFAULT 50,
  is_revoked BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.cofre_share_tokens ENABLE ROW LEVEL SECURITY;

-- Creators can manage their tokens
CREATE POLICY "Users can view own share tokens"
  ON public.cofre_share_tokens FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create share tokens"
  ON public.cofre_share_tokens FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own share tokens"
  ON public.cofre_share_tokens FOR UPDATE
  USING (auth.uid() = created_by);

-- Public read for token validation (edge function uses service role, but just in case)
CREATE POLICY "Anon can read tokens for validation"
  ON public.cofre_share_tokens FOR SELECT
  USING (true);

CREATE INDEX idx_cofre_share_tokens_token ON public.cofre_share_tokens(token);
CREATE INDEX idx_cofre_share_tokens_expires ON public.cofre_share_tokens(expires_at);
