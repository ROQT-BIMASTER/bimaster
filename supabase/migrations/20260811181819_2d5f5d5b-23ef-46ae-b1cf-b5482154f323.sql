CREATE TABLE public.fabrica_perfis_markup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fabrica_perfis_markup_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.fabrica_perfis_markup(id) ON DELETE CASCADE,
  tabela_id uuid REFERENCES public.fabrica_tabelas_preco(id) ON DELETE CASCADE,
  nome_linha text,
  tipo_markup text NOT NULL DEFAULT 'percentual',
  valor_markup numeric(14,4) NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perfis_markup_itens_perfil ON public.fabrica_perfis_markup_itens(perfil_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_perfis_markup TO authenticated;
GRANT ALL ON public.fabrica_perfis_markup TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_perfis_markup_itens TO authenticated;
GRANT ALL ON public.fabrica_perfis_markup_itens TO service_role;

ALTER TABLE public.fabrica_perfis_markup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_perfis_markup_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfis_markup_select" ON public.fabrica_perfis_markup
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfis_markup_insert" ON public.fabrica_perfis_markup
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perfis_markup_update" ON public.fabrica_perfis_markup
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perfis_markup_delete" ON public.fabrica_perfis_markup
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "perfis_markup_itens_select" ON public.fabrica_perfis_markup_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfis_markup_itens_write" ON public.fabrica_perfis_markup_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fabrica_perfis_markup p WHERE p.id = perfil_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fabrica_perfis_markup p WHERE p.id = perfil_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TRIGGER trg_perfis_markup_updated_at BEFORE UPDATE ON public.fabrica_perfis_markup
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_perfis_markup_itens_updated_at BEFORE UPDATE ON public.fabrica_perfis_markup_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.fabrica_perfis_markup (id, nome, descricao)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Perfil A — Padrão', 'Clear 10% sobre custo fábrica, Mude 42%, Primavera 8%, Deep 1,7x'),
  ('22222222-2222-4222-8222-222222222222', 'Perfil B — Primavera 30%', 'Mesma cadeia do Perfil A com Primavera a 30%');

INSERT INTO public.fabrica_perfis_markup_itens (perfil_id, tabela_id, nome_linha, tipo_markup, valor_markup, ordem)
SELECT '11111111-1111-4111-8111-111111111111', t.id, t.nome, v.tipo, v.valor, v.ordem
FROM (VALUES
  ('Tabela Clear', 'percentual', 10.0, 1),
  ('Tabela Mude', 'percentual', 42.0, 2),
  ('Tabela Primavera', 'percentual', 8.0, 3),
  ('Tabela Deep', 'multiplicador', 1.7, 4)
) AS v(nome, tipo, valor, ordem)
JOIN public.fabrica_tabelas_preco t ON t.nome = v.nome;

INSERT INTO public.fabrica_perfis_markup_itens (perfil_id, tabela_id, nome_linha, tipo_markup, valor_markup, ordem)
SELECT '22222222-2222-4222-8222-222222222222', t.id, t.nome, v.tipo, v.valor, v.ordem
FROM (VALUES
  ('Tabela Clear', 'percentual', 10.0, 1),
  ('Tabela Mude', 'percentual', 42.0, 2),
  ('Tabela Primavera', 'percentual', 30.0, 3),
  ('Tabela Deep', 'multiplicador', 1.7, 4)
) AS v(nome, tipo, valor, ordem)
JOIN public.fabrica_tabelas_preco t ON t.nome = v.nome;