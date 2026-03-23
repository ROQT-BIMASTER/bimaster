
CREATE TABLE public.fornecedor_modulo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL UNIQUE,
  tabela_fornecedores text NOT NULL DEFAULT 'fornecedores',
  compartilhado boolean DEFAULT false,
  descricao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fornecedor_modulo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fornecedor_modulo_config"
  ON public.fornecedor_modulo_config FOR SELECT TO authenticated USING (true);

INSERT INTO public.fornecedor_modulo_config (modulo, tabela_fornecedores, compartilhado, descricao) VALUES
  ('fabrica', 'fabrica_fornecedores', false, 'Fornecedores da Fábrica (empresa separada)'),
  ('contas_pagar', 'fornecedores', true, 'Fornecedores de Contas a Pagar'),
  ('trade', 'fornecedores', true, 'Fornecedores de Trade Marketing'),
  ('eventos', 'fornecedores', true, 'Fornecedores de Eventos');
