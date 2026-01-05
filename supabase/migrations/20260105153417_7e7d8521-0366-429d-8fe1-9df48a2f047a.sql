-- Add email_remetente field to configuracoes_cobranca
ALTER TABLE public.configuracoes_cobranca
ADD COLUMN IF NOT EXISTS email_remetente VARCHAR(255),
ADD COLUMN IF NOT EXISTS nome_remetente VARCHAR(255);

COMMENT ON COLUMN public.configuracoes_cobranca.email_remetente IS 'Email corporativo do usuário para envio de cobranças';
COMMENT ON COLUMN public.configuracoes_cobranca.nome_remetente IS 'Nome que aparecerá como remetente nos emails';