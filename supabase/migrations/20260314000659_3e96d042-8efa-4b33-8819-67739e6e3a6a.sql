
-- =====================================================
-- Cofre do Produto: Config + Itens tables
-- =====================================================

-- 1. Config table — items configurable by Brasil
CREATE TABLE public.cofre_produto_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_pt TEXT NOT NULL,
  nome_zh TEXT,
  tipo_anexo TEXT NOT NULL DEFAULT 'qualquer' CHECK (tipo_anexo IN ('foto','video','documento','qualquer')),
  qtd_minima INTEGER NOT NULL DEFAULT 1,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  aplicavel_a JSONB NOT NULL DEFAULT '{"tipo":"todos"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Itens table — per-submission items
CREATE TABLE public.cofre_produto_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.cofre_produto_config(id),
  tipo_documento TEXT NOT NULL,
  nome_pt TEXT NOT NULL,
  nome_zh TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  qtd_minima INTEGER NOT NULL DEFAULT 1,
  tipo_anexo TEXT NOT NULL DEFAULT 'qualquer',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','devolvido')),
  observacao_brasil TEXT,
  adicionado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add cofre_item_id to china_produto_documentos for linking
ALTER TABLE public.china_produto_documentos
  ADD COLUMN IF NOT EXISTS cofre_item_id UUID REFERENCES public.cofre_produto_itens(id);

-- 4. RLS
ALTER TABLE public.cofre_produto_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cofre_produto_itens ENABLE ROW LEVEL SECURITY;

-- Config: all authenticated can read, admin can write
CREATE POLICY "Authenticated can read cofre config"
  ON public.cofre_produto_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage cofre config"
  ON public.cofre_produto_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Itens: all authenticated can read/write (China needs to create items)
CREATE POLICY "Authenticated can read cofre itens"
  ON public.cofre_produto_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert cofre itens"
  ON public.cofre_produto_itens FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update cofre itens"
  ON public.cofre_produto_itens FOR UPDATE TO authenticated USING (true);

-- 5. Seed with existing PHOTO_FIELDS + Pedido China
INSERT INTO public.cofre_produto_config (nome_pt, nome_zh, tipo_anexo, qtd_minima, obrigatorio, aplicavel_a, status, ordem) VALUES
  ('Pedido China (Planilha Excel)', '中国订单（Excel表格）', 'documento', 1, true, '{"tipo":"todos"}', 'ativo', 0),
  ('Produto Confirmado', '已确认产品', 'foto', 1, true, '{"tipo":"todos"}', 'ativo', 1),
  ('Todas as Cores', '所有颜色照片', 'foto', 1, true, '{"tipo":"todos"}', 'ativo', 2),
  ('Garrafa/Frasco', '瓶子', 'foto', 1, false, '{"tipo":"todos"}', 'ativo', 3),
  ('Design Garrafa', '瓶子设计', 'foto', 1, false, '{"tipo":"todos"}', 'ativo', 4),
  ('Cores do Produto', '产品颜色', 'foto', 1, false, '{"tipo":"todos"}', 'ativo', 5),
  ('Embalagem', '包装', 'foto', 1, false, '{"tipo":"todos"}', 'ativo', 6),
  ('Produto Individual', '单个产品', 'foto', 1, false, '{"tipo":"todos"}', 'ativo', 7),
  ('Cores (Pesos)', '颜色（重量部分）', 'foto', 1, false, '{"tipo":"todos"}', 'ativo', 8);
