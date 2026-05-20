
-- ============================================================
-- Briefings module (hub com agente IA multi-habilidades)
-- ============================================================

-- Templates por tipo
CREATE TABLE IF NOT EXISTS public.briefing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('marketing','criativo','produto','trade')),
  versao smallint NOT NULL DEFAULT 1,
  nome text NOT NULL,
  descricao text,
  secoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, versao)
);

ALTER TABLE public.briefing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates visiveis a autenticados"
  ON public.briefing_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Templates so admin altera"
  ON public.briefing_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_briefing_templates_updated
  BEFORE UPDATE ON public.briefing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Briefings (documento principal)
CREATE TABLE IF NOT EXISTS public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('marketing','criativo','produto','trade')),
  titulo text NOT NULL DEFAULT 'Novo briefing',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_andamento','final','arquivado')),
  template_id uuid REFERENCES public.briefing_templates(id),
  projeto_id uuid,
  empresa_id bigint,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  completude smallint NOT NULL DEFAULT 0 CHECK (completude BETWEEN 0 AND 100),
  ultimo_export_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_user      ON public.briefings(user_id);
CREATE INDEX IF NOT EXISTS idx_briefings_projeto   ON public.briefings(projeto_id) WHERE projeto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_briefings_tipo      ON public.briefings(tipo);
CREATE INDEX IF NOT EXISTS idx_briefings_status    ON public.briefings(status);

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Briefings: criador ve"
  ON public.briefings FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (projeto_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = briefings.projeto_id
        AND pm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Briefings: criador insere"
  ON public.briefings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Briefings: criador atualiza"
  ON public.briefings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Briefings: criador deleta"
  ON public.briefings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_briefings_updated
  BEFORE UPDATE ON public.briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens do chat
CREATE TABLE IF NOT EXISTS public.briefing_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_calls jsonb,
  proposals jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_mensagens_briefing
  ON public.briefing_mensagens(briefing_id, created_at);

ALTER TABLE public.briefing_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mensagens: herdam visibilidade do briefing"
  ON public.briefing_mensagens FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_mensagens.briefing_id
  ));

CREATE POLICY "Mensagens: dono do briefing escreve"
  ON public.briefing_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_mensagens.briefing_id
      AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Mensagens: dono deleta"
  ON public.briefing_mensagens FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_mensagens.briefing_id
      AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ============================================================
-- Seeds dos 4 templates iniciais
-- ============================================================
INSERT INTO public.briefing_templates (tipo, versao, nome, descricao, secoes) VALUES
('marketing', 1, 'Briefing de Marketing', 'Campanha, lançamento ou ativação de marca', '[
  {"key":"objetivo","label":"Objetivo de negócio","type":"text","required":true,"placeholder":"O que precisa acontecer no negócio?"},
  {"key":"publico","label":"Público-alvo","type":"text","required":true,"placeholder":"Quem é o público (demografia, comportamento, dores)?"},
  {"key":"insight","label":"Insight / contexto","type":"text","required":false},
  {"key":"mensagem","label":"Mensagem-chave","type":"text","required":true},
  {"key":"tom","label":"Tom de voz","type":"text","required":false,"placeholder":"Ex.: profissional, próximo, técnico"},
  {"key":"canais","label":"Canais","type":"text","required":true,"placeholder":"Onde a mensagem aparece?"},
  {"key":"kpis","label":"KPIs / métricas de sucesso","type":"text","required":true},
  {"key":"budget","label":"Verba estimada","type":"text","required":false},
  {"key":"cronograma","label":"Cronograma","type":"text","required":true},
  {"key":"concorrencia","label":"Concorrência e referências","type":"text","required":false},
  {"key":"mandatorios","label":"Mandatórios / restrições","type":"text","required":false}
]'::jsonb),

('criativo', 1, 'Briefing Criativo', 'Peças gráficas, vídeo, social, key visual', '[
  {"key":"desafio","label":"Resumo do desafio","type":"text","required":true},
  {"key":"marca","label":"Marca / identidade visual","type":"text","required":true},
  {"key":"pilares","label":"Pilares de mensagem","type":"text","required":true},
  {"key":"formatos","label":"Formatos / peças","type":"text","required":true,"placeholder":"Lista de entregáveis: stories, feed, banner, vídeo 15s..."},
  {"key":"referencias","label":"Referências visuais / mood","type":"text","required":false},
  {"key":"diretrizes","label":"Diretrizes técnicas","type":"text","required":false,"placeholder":"Resolução, proporção, safe area..."},
  {"key":"entregaveis","label":"Entregáveis e formatos finais","type":"text","required":true},
  {"key":"deadlines","label":"Deadlines","type":"text","required":true}
]'::jsonb),

('produto', 1, 'Briefing de Produto / Fábrica', 'Novo produto / formulação (PLM)', '[
  {"key":"nome_trabalho","label":"Nome de trabalho","type":"text","required":true},
  {"key":"categoria","label":"Categoria","type":"text","required":true},
  {"key":"posicionamento","label":"Posicionamento","type":"text","required":true},
  {"key":"publico","label":"Público-alvo","type":"text","required":true},
  {"key":"promessa","label":"Promessa / benefícios","type":"text","required":true},
  {"key":"diferenciais","label":"Diferenciais","type":"text","required":true},
  {"key":"concorrentes","label":"Concorrentes diretos","type":"text","required":false},
  {"key":"custo_alvo","label":"Faixa de custo-alvo","type":"text","required":false,"placeholder":"Custo industrial alvo (R$/un)"},
  {"key":"regulatorio","label":"Restrições regulatórias","type":"text","required":false},
  {"key":"embalagem","label":"Embalagem","type":"text","required":false},
  {"key":"cronograma","label":"Cronograma de lançamento","type":"text","required":true}
]'::jsonb),

('trade', 1, 'Briefing de Trade Marketing', 'Ação em PDV, materiais, incentivo', '[
  {"key":"marca_produto","label":"Marca / produto","type":"text","required":true},
  {"key":"canal","label":"Canal (PDV / distribuidor)","type":"text","required":true},
  {"key":"mecanica","label":"Mecânica da ação","type":"text","required":true},
  {"key":"shopper","label":"Público shopper","type":"text","required":true},
  {"key":"materiais","label":"Materiais (banners 3:1, displays, brindes)","type":"text","required":true},
  {"key":"incentivo","label":"Incentivo / sell-out","type":"text","required":false},
  {"key":"kpis","label":"KPIs","type":"text","required":true},
  {"key":"verba","label":"Verba","type":"text","required":false},
  {"key":"periodo","label":"Período","type":"text","required":true}
]'::jsonb)
ON CONFLICT (tipo, versao) DO NOTHING;
