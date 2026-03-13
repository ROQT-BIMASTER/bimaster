
-- Flow configuration templates
CREATE TABLE public.fluxo_aprovacao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  checklist_tipo text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fluxo_aprovacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read configs"
  ON public.fluxo_aprovacao_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or gerente can manage configs"
  ON public.fluxo_aprovacao_config FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente')
  );

-- Flow stages
CREATE TABLE public.fluxo_aprovacao_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_config(id) ON DELETE CASCADE,
  nome text NOT NULL,
  nome_cn text,
  ordem integer NOT NULL DEFAULT 0,
  tipo_aprovacao text NOT NULL DEFAULT 'simples',
  responsavel_id uuid,
  responsavel_secundario_id uuid,
  destino_aprovacao_ordem integer,
  destino_reprovacao_ordem integer,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fluxo_aprovacao_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read stages"
  ON public.fluxo_aprovacao_etapas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or gerente can manage stages"
  ON public.fluxo_aprovacao_etapas FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente')
  );

-- Approval instances
CREATE TABLE public.fluxo_aprovacao_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_config(id),
  submissao_id uuid,
  projeto_id uuid,
  produto_brasil_id uuid,
  etapa_atual_ordem integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  rodada integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fluxo_aprovacao_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read instances"
  ON public.fluxo_aprovacao_instancias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert instances"
  ON public.fluxo_aprovacao_instancias FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update instances"
  ON public.fluxo_aprovacao_instancias FOR UPDATE TO authenticated USING (true);

-- Transition history
CREATE TABLE public.fluxo_aprovacao_transicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.fluxo_aprovacao_etapas(id),
  etapa_nome text,
  usuario_id uuid REFERENCES auth.users(id),
  acao text NOT NULL,
  observacao text,
  rodada integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fluxo_aprovacao_transicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read transitions"
  ON public.fluxo_aprovacao_transicoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert transitions"
  ON public.fluxo_aprovacao_transicoes FOR INSERT TO authenticated WITH CHECK (true);

-- Parallel approvals tracking
CREATE TABLE public.fluxo_aprovacao_aprovadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_etapas(id),
  responsavel_tipo text NOT NULL,
  usuario_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pendente',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fluxo_aprovacao_aprovadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read approvers"
  ON public.fluxo_aprovacao_aprovadores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own approvals"
  ON public.fluxo_aprovacao_aprovadores FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Authenticated can insert approvers"
  ON public.fluxo_aprovacao_aprovadores FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fluxo_aprovacao_instancias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fluxo_aprovacao_transicoes;
