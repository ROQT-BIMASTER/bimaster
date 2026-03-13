
-- Tabela de amostras físicas
CREATE TABLE public.produto_amostras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  numero_rodada integer NOT NULL DEFAULT 1,
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  data_recebimento timestamptz,
  qtd_unidades integer,
  qtd_cores integer,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_url text,
  video_path text,
  checklist_resultado jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'aguardando_envio',
  aprovado_por uuid,
  aprovado_em timestamptz,
  instrucao_correcao text,
  prazo_reenvio timestamptz,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de fotos de evidência da amostra
CREATE TABLE public.produto_amostra_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amostra_id uuid REFERENCES public.produto_amostras(id) ON DELETE CASCADE NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_url text,
  angle_type text NOT NULL,
  checklist_item_key text,
  tipo text NOT NULL DEFAULT 'evidencia',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produto_amostras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_amostra_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage amostras" ON public.produto_amostras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage amostra_fotos" ON public.produto_amostra_fotos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for sample evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('amostras', 'amostras', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users upload amostras" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'amostras');
CREATE POLICY "Auth users read amostras" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'amostras');
CREATE POLICY "Auth users delete amostras" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'amostras');
CREATE POLICY "Public read amostras" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'amostras');
