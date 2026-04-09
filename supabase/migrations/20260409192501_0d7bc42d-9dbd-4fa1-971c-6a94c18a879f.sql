
-- Tabela de equipes
CREATE TABLE public.equipes_projetos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  lider_id UUID REFERENCES public.profiles(id),
  departamento_id UUID REFERENCES public.departamentos(id),
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de membros
CREATE TABLE public.equipe_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES public.equipes_projetos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(equipe_id, user_id)
);

-- RLS
ALTER TABLE public.equipes_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

-- Equipes: leitura para autenticados
CREATE POLICY "Authenticated can view equipes"
  ON public.equipes_projetos FOR SELECT TO authenticated
  USING (true);

-- Equipes: CRUD para admin
CREATE POLICY "Admins manage equipes"
  ON public.equipes_projetos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Membros: leitura para autenticados
CREATE POLICY "Authenticated can view equipe membros"
  ON public.equipe_membros FOR SELECT TO authenticated
  USING (true);

-- Membros: CRUD para admin
CREATE POLICY "Admins manage equipe membros"
  ON public.equipe_membros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_equipes_projetos_updated_at
  BEFORE UPDATE ON public.equipes_projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Time Criação
INSERT INTO public.equipes_projetos (id, nome, descricao, lider_id, departamento_id, cor)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Time Criação',
  'Equipe de criação e design de projetos',
  '2f3df7bd-7db9-404a-8093-d80168ceab70',
  '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130',
  '#8B5CF6'
);

INSERT INTO public.equipe_membros (equipe_id, user_id) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'de96ca1b-a2ef-42c7-a467-f76f1227586e'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '59fed9c7-44df-4c44-9658-e6bccc4c501b'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '7dffed05-0941-400f-bbdb-fcbf8454bea1'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c2c10cb7-6913-49cd-a836-c16742d00db5');
