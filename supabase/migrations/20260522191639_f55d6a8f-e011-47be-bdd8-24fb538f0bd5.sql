
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================================================
-- ENUMs
-- =========================================================================
DO $$ BEGIN CREATE TYPE crm_canal AS ENUM ('whatsapp','webchat','instagram','messenger','email','voz','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_provider AS ENUM ('blip','whatsapp_cloud','interno'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_conversa_status AS ENUM ('open','pending','assigned','closed','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_msg_direction AS ENUM ('in','out','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_msg_tipo AS ENUM ('text','image','audio','video','file','location','template','interactive','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_ticket_status AS ENUM ('open','in_progress','waiting','resolved','closed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_prioridade AS ENUM ('low','normal','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_presenca AS ENUM ('online','pausa','offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_roteamento AS ENUM ('round_robin','skills','priority','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE crm_ai_tipo AS ENUM ('suggest','summary','classify','sentiment','rag','rewrite'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- Funções de acesso
-- =========================================================================
CREATE OR REPLACE FUNCTION public.crm_has_access(_empresa_id integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid() AND ue.empresa_id = _empresa_id
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_is_admin(_empresa_id integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_empresas ue
      JOIN public.profiles p ON p.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND ue.empresa_id = _empresa_id
    );
$$;

-- =========================================================================
-- BOTS / FLUXOS BLIP
-- =========================================================================
CREATE TABLE public.crm_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  descricao text,
  canal crm_canal NOT NULL DEFAULT 'whatsapp',
  provider crm_provider NOT NULL DEFAULT 'blip',
  bot_key_cifrada text NOT NULL,
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  identificador_externo text,
  numero_whatsapp text,
  ativo boolean NOT NULL DEFAULT true,
  modo_leitura boolean NOT NULL DEFAULT true,
  ultimo_sync_at timestamptz,
  ultimo_erro text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_bots_empresa ON public.crm_bots(empresa_id) WHERE ativo;

CREATE TABLE public.crm_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  gestor_id uuid REFERENCES auth.users(id),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_filas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  departamento_id uuid REFERENCES public.crm_departamentos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cor text,
  regra_roteamento crm_roteamento NOT NULL DEFAULT 'round_robin',
  skills text[] NOT NULL DEFAULT '{}',
  prioridade int NOT NULL DEFAULT 0,
  capacidade_max_por_op int NOT NULL DEFAULT 5,
  horario_funcionamento jsonb NOT NULL DEFAULT '{}'::jsonb,
  transbordo_fila_id uuid,
  transbordo_apos_min int,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_filas ADD CONSTRAINT fk_crm_filas_transbordo
  FOREIGN KEY (transbordo_fila_id) REFERENCES public.crm_filas(id) ON DELETE SET NULL;
CREATE INDEX idx_crm_filas_empresa ON public.crm_filas(empresa_id);

CREATE TABLE public.crm_operadores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id integer NOT NULL,
  apelido text,
  skills text[] NOT NULL DEFAULT '{}',
  capacidade_max int NOT NULL DEFAULT 5,
  status_presenca crm_presenca NOT NULL DEFAULT 'offline',
  ultima_atividade_at timestamptz,
  filas_padrao uuid[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_operadores_empresa ON public.crm_operadores(empresa_id);

CREATE TABLE public.crm_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text,
  telefone text,
  telefone_normalizado text,
  email text,
  documento text,
  avatar_url text,
  atributos jsonb NOT NULL DEFAULT '{}'::jsonb,
  primeiro_contato_em timestamptz,
  ultimo_contato_em timestamptz,
  origem text,
  cliente_erp_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_contatos_empresa ON public.crm_contatos(empresa_id);
CREATE INDEX idx_crm_contatos_telefone ON public.crm_contatos(empresa_id, telefone_normalizado);
CREATE INDEX idx_crm_contatos_email ON public.crm_contatos(empresa_id, lower(email));

CREATE TABLE public.crm_contato_identidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.crm_contatos(id) ON DELETE CASCADE,
  provider crm_provider NOT NULL,
  external_id text NOT NULL,
  bot_id uuid REFERENCES public.crm_bots(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, external_id, bot_id)
);
CREATE INDEX idx_crm_contid_contato ON public.crm_contato_identidades(contato_id);

CREATE TABLE public.crm_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  bot_id uuid REFERENCES public.crm_bots(id) ON DELETE SET NULL,
  contato_id uuid REFERENCES public.crm_contatos(id) ON DELETE SET NULL,
  fila_id uuid REFERENCES public.crm_filas(id) ON DELETE SET NULL,
  operador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  canal crm_canal NOT NULL DEFAULT 'whatsapp',
  status crm_conversa_status NOT NULL DEFAULT 'open',
  owner text NOT NULL DEFAULT 'blip',
  external_id text,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  primeira_resposta_em timestamptz,
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  fechada_em timestamptz,
  sla_policy_id uuid,
  sla_due_at timestamptz,
  resumo_ia text,
  ultimo_motivo text,
  ultimo_sentimento text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_conv_inbox ON public.crm_conversas(empresa_id, status, ultima_mensagem_em DESC);
CREATE INDEX idx_crm_conv_operador ON public.crm_conversas(operador_id) WHERE status IN ('open','assigned','pending');
CREATE INDEX idx_crm_conv_fila ON public.crm_conversas(fila_id) WHERE status IN ('open','pending');
CREATE INDEX idx_crm_conv_contato ON public.crm_conversas(contato_id);
CREATE UNIQUE INDEX uq_crm_conv_external ON public.crm_conversas(bot_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE public.crm_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.crm_conversas(id) ON DELETE CASCADE,
  blip_id text,
  direction crm_msg_direction NOT NULL,
  tipo crm_msg_tipo NOT NULL DEFAULT 'text',
  conteudo text,
  content_tsv tsvector,
  midia_url text,
  midia_mime text,
  autor_id uuid REFERENCES auth.users(id),
  autor_nome text,
  hash_dedupe text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criada_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_crm_msg_blip ON public.crm_mensagens(blip_id) WHERE blip_id IS NOT NULL;
CREATE INDEX idx_crm_msg_conversa ON public.crm_mensagens(conversa_id, criada_em);
CREATE INDEX idx_crm_msg_fts ON public.crm_mensagens USING GIN(content_tsv);
CREATE INDEX idx_crm_msg_empresa_dia ON public.crm_mensagens(empresa_id, criada_em DESC);

CREATE OR REPLACE FUNCTION public.crm_msg_tsv_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.content_tsv := to_tsvector('portuguese', coalesce(NEW.conteudo,'')); RETURN NEW; END;
$$;
CREATE TRIGGER trg_crm_msg_tsv BEFORE INSERT OR UPDATE OF conteudo
  ON public.crm_mensagens FOR EACH ROW EXECUTE FUNCTION public.crm_msg_tsv_trigger();

CREATE TABLE public.crm_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  mensagem_id uuid NOT NULL REFERENCES public.crm_mensagens(id) ON DELETE CASCADE,
  storage_path text,
  url_externa text,
  nome_arquivo text,
  mime text,
  tamanho_bytes bigint,
  scan_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_anexos_msg ON public.crm_anexos(mensagem_id);

CREATE TABLE public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  cor text,
  escopo text NOT NULL DEFAULT 'ambos',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome)
);
CREATE TABLE public.crm_conversa_tags (
  conversa_id uuid NOT NULL REFERENCES public.crm_conversas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversa_id, tag_id)
);
CREATE TABLE public.crm_contato_tags (
  contato_id uuid NOT NULL REFERENCES public.crm_contatos(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contato_id, tag_id)
);

CREATE TABLE public.crm_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  tempo_primeira_resposta_min int,
  tempo_resolucao_min int,
  horario_util jsonb NOT NULL DEFAULT '{}'::jsonb,
  prioridade crm_prioridade NOT NULL DEFAULT 'normal',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  conversa_id uuid REFERENCES public.crm_conversas(id) ON DELETE CASCADE,
  ticket_id uuid,
  tipo text NOT NULL,
  ocorreu_em timestamptz NOT NULL DEFAULT now(),
  atraso_seg int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_crm_sla_events_conv ON public.crm_sla_events(conversa_id);

CREATE SEQUENCE IF NOT EXISTS crm_ticket_seq;

CREATE TABLE public.crm_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  numero bigint NOT NULL DEFAULT nextval('crm_ticket_seq'),
  contato_id uuid REFERENCES public.crm_contatos(id) ON DELETE SET NULL,
  fila_id uuid REFERENCES public.crm_filas(id) ON DELETE SET NULL,
  operador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  status crm_ticket_status NOT NULL DEFAULT 'open',
  prioridade crm_prioridade NOT NULL DEFAULT 'normal',
  sla_policy_id uuid REFERENCES public.crm_sla_policies(id) ON DELETE SET NULL,
  sla_due_at timestamptz,
  motivo text,
  satisfacao int CHECK (satisfacao IS NULL OR satisfacao BETWEEN 1 AND 5),
  aberto_por uuid REFERENCES auth.users(id),
  aberto_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  fechado_em timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_tickets_empresa ON public.crm_tickets(empresa_id, status);
CREATE INDEX idx_crm_tickets_contato ON public.crm_tickets(contato_id);

CREATE TABLE public.crm_conversa_ticket (
  conversa_id uuid NOT NULL REFERENCES public.crm_conversas(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  PRIMARY KEY (conversa_id, ticket_id)
);

CREATE TABLE public.crm_templates_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  categoria text,
  idioma text NOT NULL DEFAULT 'pt_BR',
  conteudo text NOT NULL,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  aprovado boolean NOT NULL DEFAULT false,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  template_id uuid REFERENCES public.crm_templates_whatsapp(id) ON DELETE SET NULL,
  segmentacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  agendamento_at timestamptz,
  status text NOT NULL DEFAULT 'rascunho',
  ab_grupos jsonb,
  optout_lista_id uuid,
  criada_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_campanha_alvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.crm_campanhas(id) ON DELETE CASCADE,
  contato_id uuid REFERENCES public.crm_contatos(id) ON DELETE SET NULL,
  variante text,
  status text NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  erro text
);
CREATE INDEX idx_crm_camp_alvos ON public.crm_campanha_alvos(campanha_id, status);

CREATE TABLE public.crm_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  conversa_id uuid REFERENCES public.crm_conversas(id) ON DELETE CASCADE,
  tipo crm_ai_tipo NOT NULL,
  modelo text NOT NULL,
  input_hash text,
  output jsonb,
  tokens_in int,
  tokens_out int,
  custo_usd numeric(10,6),
  latencia_ms int,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_ai_runs_conv ON public.crm_ai_runs(conversa_id, created_at DESC);

CREATE TABLE public.crm_ai_classificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.crm_conversas(id) ON DELETE CASCADE,
  intencao text,
  sentimento text,
  urgencia text,
  motivo text,
  kb_refs jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_kb_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  titulo text NOT NULL,
  fonte text,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.crm_kb_documentos(id) ON DELETE CASCADE,
  empresa_id integer NOT NULL,
  ordem int NOT NULL,
  conteudo text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_kb_chunks_doc ON public.crm_kb_chunks(documento_id, ordem);

CREATE TABLE public.crm_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  nome text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  eventos text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  dlq_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_webhooks_in_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  bot_id uuid REFERENCES public.crm_bots(id) ON DELETE SET NULL,
  raw jsonb NOT NULL,
  headers jsonb,
  hmac_ok boolean,
  idempotency_key text,
  processed_at timestamptz,
  erro text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_whin_bot ON public.crm_webhooks_in_log(bot_id, received_at DESC);
CREATE UNIQUE INDEX uq_crm_whin_idem ON public.crm_webhooks_in_log(bot_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE public.crm_webhooks_out_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  endpoint_id uuid REFERENCES public.crm_webhook_endpoints(id) ON DELETE CASCADE,
  evento text NOT NULL,
  payload jsonb NOT NULL,
  status int,
  tentativa int NOT NULL DEFAULT 0,
  proxima_tentativa_at timestamptz,
  erro text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  tipo text NOT NULL,
  nome text NOT NULL,
  config_cifrada text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  escopo text NOT NULL DEFAULT 'tenant',
  escopo_id uuid,
  chave text NOT NULL,
  valor jsonb NOT NULL DEFAULT 'false'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, escopo, escopo_id, chave)
);

CREATE TABLE public.crm_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  destinatario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  payload jsonb,
  lido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_notif_dest ON public.crm_notificacoes(destinatario_id, created_at DESC) WHERE lido_em IS NULL;

CREATE TABLE public.crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL,
  ator_id uuid,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_audit_empresa ON public.crm_audit_log(empresa_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.crm_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['crm_bots','crm_filas','crm_operadores','crm_contatos','crm_conversas','crm_tickets','crm_campanhas','crm_kb_documentos','crm_feature_flags'])
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_upd BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at()', t, t);
  END LOOP;
END $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'crm_bots','crm_departamentos','crm_filas','crm_operadores',
    'crm_contatos','crm_contato_identidades','crm_conversas','crm_mensagens','crm_anexos',
    'crm_tags','crm_conversa_tags','crm_contato_tags',
    'crm_sla_policies','crm_sla_events','crm_tickets','crm_conversa_ticket',
    'crm_templates_whatsapp','crm_campanhas','crm_campanha_alvos',
    'crm_ai_runs','crm_ai_classificacoes','crm_kb_documentos','crm_kb_chunks',
    'crm_webhook_endpoints','crm_webhooks_in_log','crm_webhooks_out_log',
    'crm_integracoes','crm_feature_flags','crm_notificacoes','crm_audit_log'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'crm_bots','crm_departamentos','crm_filas','crm_operadores',
    'crm_contatos','crm_conversas','crm_mensagens','crm_anexos',
    'crm_tags','crm_sla_policies','crm_sla_events',
    'crm_tickets','crm_templates_whatsapp','crm_campanhas',
    'crm_ai_runs','crm_ai_classificacoes','crm_kb_documentos','crm_kb_chunks',
    'crm_webhook_endpoints','crm_webhooks_out_log','crm_integracoes','crm_feature_flags','crm_audit_log'])
  LOOP
    EXECUTE format('CREATE POLICY "crm_select_%1$s" ON public.%1$I FOR SELECT USING (public.crm_has_access(empresa_id))', t);
    EXECUTE format('CREATE POLICY "crm_write_%1$s" ON public.%1$I FOR ALL USING (public.crm_is_admin(empresa_id)) WITH CHECK (public.crm_is_admin(empresa_id))', t);
  END LOOP;
END $$;

CREATE POLICY "crm_whin_admin" ON public.crm_webhooks_in_log FOR ALL
  USING (public.crm_is_admin(empresa_id)) WITH CHECK (public.crm_is_admin(empresa_id));

CREATE POLICY "crm_notif_owner_sel" ON public.crm_notificacoes FOR SELECT USING (destinatario_id = auth.uid());
CREATE POLICY "crm_notif_owner_upd" ON public.crm_notificacoes FOR UPDATE USING (destinatario_id = auth.uid());

CREATE POLICY "crm_contid_sel" ON public.crm_contato_identidades FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_contatos c WHERE c.id = contato_id AND public.crm_has_access(c.empresa_id)));
CREATE POLICY "crm_contid_wr" ON public.crm_contato_identidades FOR ALL
  USING (EXISTS (SELECT 1 FROM crm_contatos c WHERE c.id = contato_id AND public.crm_is_admin(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_contatos c WHERE c.id = contato_id AND public.crm_is_admin(c.empresa_id)));

CREATE POLICY "crm_ctags_sel" ON public.crm_conversa_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_conversas c WHERE c.id = conversa_id AND public.crm_has_access(c.empresa_id)));
CREATE POLICY "crm_ctags_wr" ON public.crm_conversa_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM crm_conversas c WHERE c.id = conversa_id AND public.crm_has_access(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_conversas c WHERE c.id = conversa_id AND public.crm_has_access(c.empresa_id)));

CREATE POLICY "crm_cttags_sel" ON public.crm_contato_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_contatos c WHERE c.id = contato_id AND public.crm_has_access(c.empresa_id)));
CREATE POLICY "crm_cttags_wr" ON public.crm_contato_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM crm_contatos c WHERE c.id = contato_id AND public.crm_has_access(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_contatos c WHERE c.id = contato_id AND public.crm_has_access(c.empresa_id)));

CREATE POLICY "crm_convtk_sel" ON public.crm_conversa_ticket FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_conversas c WHERE c.id = conversa_id AND public.crm_has_access(c.empresa_id)));
CREATE POLICY "crm_convtk_wr" ON public.crm_conversa_ticket FOR ALL
  USING (EXISTS (SELECT 1 FROM crm_conversas c WHERE c.id = conversa_id AND public.crm_has_access(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_conversas c WHERE c.id = conversa_id AND public.crm_has_access(c.empresa_id)));

CREATE POLICY "crm_camp_alvos_sel" ON public.crm_campanha_alvos FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_campanhas c WHERE c.id = campanha_id AND public.crm_has_access(c.empresa_id)));
CREATE POLICY "crm_camp_alvos_wr" ON public.crm_campanha_alvos FOR ALL
  USING (EXISTS (SELECT 1 FROM crm_campanhas c WHERE c.id = campanha_id AND public.crm_is_admin(c.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_campanhas c WHERE c.id = campanha_id AND public.crm_is_admin(c.empresa_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_operadores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_notificacoes;
