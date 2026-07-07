
ALTER TABLE public.erp_contas_pagar_rubysp
  ADD COLUMN IF NOT EXISTS setor_tpg  integer,
  ADD COLUMN IF NOT EXISTS setor_nome text;
