
-- ============================================================
-- SECURITY HARDENING — Maio/2026 (Aikido scan fixes)
-- ============================================================

-- 1) cofre_generico_documentos: SELECT só admin
DROP POLICY IF EXISTS "cgd_select" ON public.cofre_generico_documentos;
CREATE POLICY "cgd_select_admin_only"
ON public.cofre_generico_documentos FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) fluxo_aprovacao_aprovadores: remover policies abertas
DROP POLICY IF EXISTS "Authenticated can read approvers" ON public.fluxo_aprovacao_aprovadores;
DROP POLICY IF EXISTS "Authenticated users can update fluxo_aprovacao_aprovadores" ON public.fluxo_aprovacao_aprovadores;

-- 3) processo_instancias: substituir SELECT aberto por scoped
DROP POLICY IF EXISTS "Autenticados leem instancias" ON public.processo_instancias;
CREATE POLICY "processo_instancias_scoped_select"
ON public.processo_instancias FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR created_by = auth.uid()
);

-- 4) fabrica_markup_overrides
DROP POLICY IF EXISTS "Authenticated users can view markup overrides" ON public.fabrica_markup_overrides;
CREATE POLICY "fabrica_markup_overrides_select_scoped"
ON public.fabrica_markup_overrides FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text)
);

-- 5) produtos_brasil_custos / produtos_brasil_precos
DROP POLICY IF EXISTS "Authenticated users can view produtos_brasil_custos" ON public.produtos_brasil_custos;
CREATE POLICY "produtos_brasil_custos_select_scoped"
ON public.produtos_brasil_custos FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'::text)
);

DROP POLICY IF EXISTS "Authenticated users can view produtos_brasil_precos" ON public.produtos_brasil_precos;
CREATE POLICY "produtos_brasil_precos_select_scoped"
ON public.produtos_brasil_precos FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'::text)
);

-- 6) trade_bank_daily_balances
DROP POLICY IF EXISTS "Allow authenticated users to view bank daily balances" ON public.trade_bank_daily_balances;
CREATE POLICY "trade_bank_daily_balances_select_scoped"
ON public.trade_bank_daily_balances FOR SELECT
TO authenticated
USING (can_access_bank_accounts(auth.uid()));

-- 7) fabrica_notas_fiscais_saida / fabrica_itens_nf_saida
DROP POLICY IF EXISTS "Authenticated users can view NF saida" ON public.fabrica_notas_fiscais_saida;
CREATE POLICY "fabrica_nfs_saida_select_scoped"
ON public.fabrica_notas_fiscais_saida FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'::text)
);

DROP POLICY IF EXISTS "Authenticated users can view itens NF saida" ON public.fabrica_itens_nf_saida;
CREATE POLICY "fabrica_itens_nfs_saida_select_scoped"
ON public.fabrica_itens_nf_saida FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'::text)
);

-- 8) Storage — remover policies sem ownership (variantes "Users can ..." já cobrem o caso)
DROP POLICY IF EXISTS "Auth users upload embalagem-analise" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload etiqueta-bula" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload amostras" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete embalagem-analise" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete etiqueta-bula" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete amostras" ON storage.objects;

-- 8b) fabrica-produto-fotos: aplicar ownership por path + admin
DROP POLICY IF EXISTS "fabrica_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_delete" ON storage.objects;

CREATE POLICY "fabrica_fotos_select_scoped"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'::text)
  )
);

CREATE POLICY "fabrica_fotos_insert_owned"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);

CREATE POLICY "fabrica_fotos_update_owned"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);

CREATE POLICY "fabrica_fotos_delete_owned"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);
