
-- Tabela de Ordens de Compra emitidas pelo Brasil
CREATE TABLE public.china_ordens_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_oc text UNIQUE NOT NULL,
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  produto_codigo text NOT NULL,
  produto_nome text NOT NULL,
  qty_total integer NOT NULL DEFAULT 0,
  qty_produzida integer NOT NULL DEFAULT 0,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_entrega_prevista date,
  data_entrega_real date,
  status text NOT NULL DEFAULT 'emitida',
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de Apontamentos de Produção pela China
CREATE TABLE public.china_producao_apontamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id uuid REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE NOT NULL,
  cor_nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  lote text,
  data_producao date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  foto_url text,
  foto_path text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at para ordens
CREATE TRIGGER handle_china_ordens_updated_at
  BEFORE UPDATE ON public.china_ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.china_ordens_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.china_producao_apontamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para ordens de compra (autenticados podem ler, inserir e atualizar)
CREATE POLICY "Authenticated users can view china_ordens_compra"
  ON public.china_ordens_compra FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert china_ordens_compra"
  ON public.china_ordens_compra FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update china_ordens_compra"
  ON public.china_ordens_compra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Políticas para apontamentos de produção
CREATE POLICY "Authenticated users can view china_producao_apontamentos"
  ON public.china_producao_apontamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert china_producao_apontamentos"
  ON public.china_producao_apontamentos FOR INSERT TO authenticated WITH CHECK (true);

-- Habilitar realtime para acompanhamento em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_ordens_compra;
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_producao_apontamentos;

-- Sequência para número da OC
CREATE SEQUENCE IF NOT EXISTS china_oc_seq START 1;
