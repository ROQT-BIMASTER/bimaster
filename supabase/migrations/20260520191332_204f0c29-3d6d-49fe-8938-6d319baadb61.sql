
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS visibilidade text NOT NULL DEFAULT 'broadcast',
  ADD COLUMN IF NOT EXISTS ticket_owner_id uuid,
  ADD COLUMN IF NOT EXISTS ticket_id uuid;

ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_visibilidade_check;
ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_visibilidade_check
  CHECK (visibilidade IN ('broadcast', 'privada_suporte'));

CREATE INDEX IF NOT EXISTS idx_mensagens_ticket_owner ON public.mensagens(conversa_id, ticket_owner_id) WHERE ticket_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_ticket_id ON public.mensagens(ticket_id) WHERE ticket_id IS NOT NULL;

DROP POLICY IF EXISTS "Usuários podem ver mensagens de suas conversas" ON public.mensagens;
CREATE POLICY "Ver mensagens conforme visibilidade e participação"
  ON public.mensagens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversas_participantes cp
      WHERE cp.conversa_id = mensagens.conversa_id
        AND cp.usuario_id = auth.uid()
    )
    AND (
      visibilidade = 'broadcast'
      OR remetente_id = auth.uid()
      OR ticket_owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'suporte'::app_role)
    )
  );

CREATE TABLE IF NOT EXISTS public.suporte_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  projeto_tarefa_id uuid,
  status text NOT NULL DEFAULT 'novo',
  prioridade text NOT NULL DEFAULT 'media',
  sentimento text,
  titulo text,
  resumo text,
  ultima_interacao_em timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  escalado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suporte_tickets_status_check CHECK (status IN ('novo','em_triagem','em_atendimento','aguardando_usuario','resolvido','escalado')),
  CONSTRAINT suporte_tickets_prioridade_check CHECK (prioridade IN ('baixa','media','alta','critica'))
);

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_owner ON public.suporte_tickets(owner_id);
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_status ON public.suporte_tickets(status);

ALTER TABLE public.suporte_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner e suporte veem tickets"
  ON public.suporte_tickets FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  );

CREATE POLICY "Suporte atualiza tickets"
  ON public.suporte_tickets FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  );

CREATE TRIGGER trg_suporte_tickets_updated_at
  BEFORE UPDATE ON public.suporte_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.suporte_csat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score smallint NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suporte_csat_score_check CHECK (score BETWEEN 1 AND 5)
);

ALTER TABLE public.suporte_csat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User envia seu CSAT"
  ON public.suporte_csat FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner e suporte veem CSAT"
  ON public.suporte_csat FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.suporte_tickets_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  acao text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  modelo_ia text,
  resultado text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suporte_tickets_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suporte vê audit"
  ON public.suporte_tickets_audit FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.suporte_kb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suporte_kb_modulo ON public.suporte_kb(modulo) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_suporte_kb_titulo_trgm ON public.suporte_kb USING gin (titulo gin_trgm_ops);

ALTER TABLE public.suporte_kb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leem KB"
  ON public.suporte_kb FOR SELECT TO authenticated USING (ativo);

CREATE POLICY "Admin gerencia KB"
  ON public.suporte_kb FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_suporte_kb_updated_at
  BEFORE UPDATE ON public.suporte_kb
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  v_admin uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
  v_projeto_id uuid;
BEGIN
  SELECT id INTO v_projeto_id FROM public.projetos WHERE nome = 'Suporte' AND tipo = 'generico' LIMIT 1;
  IF v_projeto_id IS NULL THEN
    INSERT INTO public.projetos (nome, descricao, cor, icone, criador_id, status, tipo, visibilidade)
    VALUES ('Suporte', 'Tickets de atendimento ao usuário (canal Suporte do Sistema).', '#E91E78', 'life-buoy', v_admin, 'ativo', 'generico', 'equipe')
    RETURNING id INTO v_projeto_id;

    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES
      (v_projeto_id, 'Novo', 1),
      (v_projeto_id, 'Em triagem', 2),
      (v_projeto_id, 'Em atendimento', 3),
      (v_projeto_id, 'Aguardando usuário', 4),
      (v_projeto_id, 'Resolvido', 5);

    INSERT INTO public.projeto_membros (projeto_id, user_id, papel) VALUES
      (v_projeto_id, v_admin, 'coordenador')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT v_admin, 'suporte'::app_role
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_admin AND role = 'suporte'::app_role);
END $$;

INSERT INTO public.suporte_kb (modulo, titulo, conteudo, palavras_chave) VALUES
  ('chat', 'Como ativar notificações no navegador', 'Acesse Configurações > Notificações e clique em "Permitir". No Chrome/Edge, confirme o popup do navegador. Em iPhone, é necessário instalar o app via "Adicionar à Tela de Início" no Safari.', ARRAY['notificação','notificacao','push','aviso','alerta']),
  ('chat', 'Anexar arquivos no chat', 'Clique no ícone de clipe ao lado do campo de texto. Limite de 20 MB por arquivo. Aceita PDF, imagens, áudio e documentos Office.', ARRAY['anexo','arquivo','upload','enviar']),
  ('projetos', 'Criar tarefa', 'Em Projetos > selecione o projeto > Kanban > clique em "+" na coluna desejada. Preencha título, prazo e responsável.', ARRAY['tarefa','task','kanban','criar']),
  ('financeiro', 'DRE não está fechando', 'Verifique se todas as contas estão classificadas no plano de contas v2. Acesse Financeiro > DRE > clique em "Reprocessar" no canto superior direito.', ARRAY['dre','financeiro','fechamento','divergencia']),
  ('geral', 'Esqueci minha senha', 'Na tela de login, clique em "Esqueci minha senha". Você receberá um link por e-mail. Se não chegar, verifique o spam e contate o admin da sua empresa.', ARRAY['senha','login','acesso','password']);
