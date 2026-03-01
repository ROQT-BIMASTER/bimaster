
-- =============================================
-- STEP 3: Harden fabrica_notas_fiscais & fabrica_itens_nf RLS
-- Replace USING(true) with can_access_fabrica(auth.uid())
-- =============================================

-- fabrica_notas_fiscais: drop permissive policies, recreate strict
DROP POLICY IF EXISTS "Authenticated users can view notas fiscais" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Authenticated users can insert notas fiscais" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Authenticated users can update notas fiscais" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "fabrica_nf_select" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "fabrica_nf_insert" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "fabrica_nf_update" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "fabrica_nf_delete" ON public.fabrica_notas_fiscais;

CREATE POLICY "fabrica_nf_select_strict" ON public.fabrica_notas_fiscais
FOR SELECT TO authenticated
USING (can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_nf_insert_strict" ON public.fabrica_notas_fiscais
FOR INSERT TO authenticated
WITH CHECK (can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_nf_update_strict" ON public.fabrica_notas_fiscais
FOR UPDATE TO authenticated
USING (can_access_fabrica(auth.uid()))
WITH CHECK (can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_nf_delete_strict" ON public.fabrica_notas_fiscais
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- fabrica_itens_nf: same treatment
DROP POLICY IF EXISTS "Authenticated users can view itens nf" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "Authenticated users can insert itens nf" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "Authenticated users can update itens nf" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "fabrica_itens_nf_select" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "fabrica_itens_nf_insert" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "fabrica_itens_nf_update" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "fabrica_itens_nf_delete" ON public.fabrica_itens_nf;

CREATE POLICY "fabrica_itens_nf_select_strict" ON public.fabrica_itens_nf
FOR SELECT TO authenticated
USING (can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_itens_nf_insert_strict" ON public.fabrica_itens_nf
FOR INSERT TO authenticated
WITH CHECK (can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_itens_nf_update_strict" ON public.fabrica_itens_nf
FOR UPDATE TO authenticated
USING (can_access_fabrica(auth.uid()))
WITH CHECK (can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_itens_nf_delete_strict" ON public.fabrica_itens_nf
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- STEP 4: Explicit anon denial on remaining financial tables
-- =============================================

-- trade_financial_entries
DROP POLICY IF EXISTS "deny_anon_trade_financial" ON public.trade_financial_entries;
CREATE POLICY "deny_anon_trade_financial" ON public.trade_financial_entries
FOR ALL TO anon USING (false) WITH CHECK (false);

-- trade_budgets
DROP POLICY IF EXISTS "deny_anon_trade_budgets" ON public.trade_budgets;
CREATE POLICY "deny_anon_trade_budgets" ON public.trade_budgets
FOR ALL TO anon USING (false) WITH CHECK (false);

-- fabrica_fornecedores
DROP POLICY IF EXISTS "deny_anon_fabrica_fornecedores" ON public.fabrica_fornecedores;
CREATE POLICY "deny_anon_fabrica_fornecedores" ON public.fabrica_fornecedores
FOR ALL TO anon USING (false) WITH CHECK (false);

-- team_member_details
DROP POLICY IF EXISTS "deny_anon_team_member_details" ON public.team_member_details;
CREATE POLICY "deny_anon_team_member_details" ON public.team_member_details
FOR ALL TO anon USING (false) WITH CHECK (false);

-- fabrica_notas_fiscais
DROP POLICY IF EXISTS "deny_anon_fabrica_nf" ON public.fabrica_notas_fiscais;
CREATE POLICY "deny_anon_fabrica_nf" ON public.fabrica_notas_fiscais
FOR ALL TO anon USING (false) WITH CHECK (false);

-- fabrica_itens_nf
DROP POLICY IF EXISTS "deny_anon_fabrica_itens_nf" ON public.fabrica_itens_nf;
CREATE POLICY "deny_anon_fabrica_itens_nf" ON public.fabrica_itens_nf
FOR ALL TO anon USING (false) WITH CHECK (false);

-- =============================================
-- STEP 5: Restrict team_member_details PII - only admin and own user
-- =============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "team_member_details_select" ON public.team_member_details;
DROP POLICY IF EXISTS "Users can view team member details" ON public.team_member_details;
DROP POLICY IF EXISTS "Authenticated users can view team member details" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_select_strict" ON public.team_member_details;

-- Only admin or own user can see full details (including CPF/RG)
CREATE POLICY "team_details_select_strict" ON public.team_member_details
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only admin can update other users' details
DROP POLICY IF EXISTS "team_member_details_update" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_update_strict" ON public.team_member_details;

CREATE POLICY "team_details_update_strict" ON public.team_member_details
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only admin can insert
DROP POLICY IF EXISTS "team_member_details_insert" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_insert_strict" ON public.team_member_details;

CREATE POLICY "team_details_insert_strict" ON public.team_member_details
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only admin can delete
DROP POLICY IF EXISTS "team_member_details_delete" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_delete_strict" ON public.team_member_details;

CREATE POLICY "team_details_delete_strict" ON public.team_member_details
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
