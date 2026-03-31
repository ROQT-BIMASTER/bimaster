
-- Fase 1: Adicionar coluna versao à trade_chart_of_accounts
ALTER TABLE public.trade_chart_of_accounts ADD COLUMN IF NOT EXISTS versao varchar(10) DEFAULT 'v1';

-- Marcar todas as contas existentes como v1
UPDATE public.trade_chart_of_accounts SET versao = 'v1' WHERE versao IS NULL;

-- Criar tabela de mapeamento old → new
CREATE TABLE public.plano_contas_migracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_account_id uuid REFERENCES public.trade_chart_of_accounts(id),
  old_code varchar(20),
  old_name varchar(255),
  new_account_id uuid REFERENCES public.trade_chart_of_accounts(id),
  new_code varchar(20),
  new_name varchar(255),
  confianca varchar(10) DEFAULT 'baixa',
  mapeado_por varchar(20) DEFAULT 'manual',
  confirmado boolean DEFAULT false,
  confirmado_por uuid,
  confirmado_em timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.plano_contas_migracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plano_contas_migracao_admin_only"
ON public.plano_contas_migracao FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Backup table para snapshot antes da migração
CREATE TABLE public.contas_pagar_backup_plano (
  id uuid PRIMARY KEY,
  plano_contas_id uuid,
  plano_contas_codigo varchar(50),
  plano_contas_nome varchar(255),
  backup_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contas_pagar_backup_plano ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_admin_only"
ON public.contas_pagar_backup_plano FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
