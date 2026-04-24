
-- Tabela de comentários por cena
CREATE TABLE public.roteirista_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id uuid NOT NULL REFERENCES public.roteiros_cinematograficos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  autor_nome text,
  cena_index integer,
  mensagem text NOT NULL,
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roteirista_comentarios_roteiro ON public.roteirista_comentarios(roteiro_id, cena_index);

ALTER TABLE public.roteirista_comentarios ENABLE ROW LEVEL SECURITY;

-- Dono do roteiro pode ver todos os comentários
CREATE POLICY "owner_select_comentarios" ON public.roteirista_comentarios
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roteiros_cinematograficos r
      WHERE r.id = roteiro_id AND r.user_id = auth.uid()
    )
  );

-- Dono pode inserir comentários
CREATE POLICY "owner_insert_comentarios" ON public.roteirista_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.roteiros_cinematograficos r
      WHERE r.id = roteiro_id AND r.user_id = auth.uid()
    )
  );

-- Autor pode atualizar seu próprio comentário
CREATE POLICY "author_update_comentarios" ON public.roteirista_comentarios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Autor pode excluir seu próprio comentário
CREATE POLICY "author_delete_comentarios" ON public.roteirista_comentarios
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_roteirista_comentarios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_roteirista_comentarios_updated_at
  BEFORE UPDATE ON public.roteirista_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_roteirista_comentarios_updated_at();

-- Tabela de histórico de alterações
CREATE TABLE public.roteirista_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id uuid NOT NULL REFERENCES public.roteiros_cinematograficos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  autor_nome text,
  evento text NOT NULL,
  descricao text,
  cena_index integer,
  campo text,
  valor_anterior text,
  valor_novo text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roteirista_historico_roteiro ON public.roteirista_historico(roteiro_id, created_at DESC);

ALTER TABLE public.roteirista_historico ENABLE ROW LEVEL SECURITY;

-- Dono pode ver o histórico
CREATE POLICY "owner_select_historico" ON public.roteirista_historico
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roteiros_cinematograficos r
      WHERE r.id = roteiro_id AND r.user_id = auth.uid()
    )
  );

-- Dono pode inserir entradas no histórico
CREATE POLICY "owner_insert_historico" ON public.roteirista_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.roteiros_cinematograficos r
      WHERE r.id = roteiro_id AND r.user_id = auth.uid()
    )
  );
