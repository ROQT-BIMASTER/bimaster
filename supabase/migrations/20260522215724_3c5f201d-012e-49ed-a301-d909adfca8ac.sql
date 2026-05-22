
CREATE INDEX IF NOT EXISTS idx_crm_contatos_nome_trgm
  ON public.crm_contatos USING gin (nome extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_contatos_tel_trgm
  ON public.crm_contatos USING gin (telefone extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_contatos_email_trgm
  ON public.crm_contatos USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_contatos_empresa
  ON public.crm_contatos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_crm_mensagens_tsv
  ON public.crm_mensagens USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_conversa_criada
  ON public.crm_mensagens (conversa_id, criada_em DESC);

CREATE INDEX IF NOT EXISTS idx_crm_conversas_empresa_ultima
  ON public.crm_conversas (empresa_id, ultima_mensagem_em DESC);
