
-- Add missing columns to fornecedores table for unification with fabrica_fornecedores
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS tipo_conta text,
  ADD COLUMN IF NOT EXISTS favorecido text,
  ADD COLUMN IF NOT EXISTS linha_digitavel text,
  ADD COLUMN IF NOT EXISTS erp_code text,
  ADD COLUMN IF NOT EXISTS erp_sync_status text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS porte text,
  ADD COLUMN IF NOT EXISTS capital_social numeric,
  ADD COLUMN IF NOT EXISTS situacao_cadastral text,
  ADD COLUMN IF NOT EXISTS matriz_filial text;

-- Migrate data from fabrica_fornecedores into fornecedores (match by CNPJ, skip if already exists)
INSERT INTO public.fornecedores (
  nome, cnpj, razao_social, nome_fantasia, email, telefone,
  endereco, endereco_numero, complemento, bairro, cidade, estado, cep,
  inscricao_estadual, inscricao_municipal,
  banco, agencia, conta_bancaria, tipo_conta, tipo_pix, chave_pix, favorecido, linha_digitavel,
  erp_code, erp_sync_status, erp_synced_at,
  contato, status, created_at, updated_at
)
SELECT
  ff.razao_social,
  ff.cnpj,
  ff.razao_social,
  ff.nome_fantasia,
  ff.email,
  ff.telefone,
  ff.endereco,
  ff.numero,
  ff.complemento,
  ff.bairro,
  ff.cidade,
  ff.uf,
  ff.cep,
  ff.inscricao_estadual,
  ff.inscricao_municipal,
  ff.banco,
  ff.agencia,
  ff.conta,
  ff.tipo_conta,
  ff.pix_tipo,
  ff.pix_chave,
  ff.favorecido,
  ff.linha_digitavel,
  ff.erp_code,
  ff.erp_sync_status,
  ff.erp_synced_at,
  ff.contato,
  CASE WHEN ff.ativo THEN 'ativo' ELSE 'inativo' END,
  ff.created_at,
  ff.updated_at
FROM public.fabrica_fornecedores ff
WHERE ff.cnpj IS NOT NULL
  AND ff.cnpj != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores f WHERE f.cnpj = ff.cnpj
  );

-- Also migrate fabrica_fornecedores WITHOUT CNPJ (match by razao_social)
INSERT INTO public.fornecedores (
  nome, cnpj, razao_social, nome_fantasia, email, telefone,
  banco, agencia, conta_bancaria, tipo_conta, tipo_pix, chave_pix, favorecido, linha_digitavel,
  erp_code, erp_sync_status, erp_synced_at,
  contato, status, created_at, updated_at
)
SELECT
  ff.razao_social,
  COALESCE(ff.cnpj, '00000000000000'),
  ff.razao_social,
  ff.nome_fantasia,
  ff.email,
  ff.telefone,
  ff.banco,
  ff.agencia,
  ff.conta,
  ff.tipo_conta,
  ff.pix_tipo,
  ff.pix_chave,
  ff.favorecido,
  ff.linha_digitavel,
  ff.erp_code,
  ff.erp_sync_status,
  ff.erp_synced_at,
  ff.contato,
  CASE WHEN ff.ativo THEN 'ativo' ELSE 'inativo' END,
  ff.created_at,
  ff.updated_at
FROM public.fabrica_fornecedores ff
WHERE (ff.cnpj IS NULL OR ff.cnpj = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores f WHERE f.nome = ff.razao_social
  );
