
-- Helper macros expanded inline. Padrão: china OR fabrica OR admin/supervisor.

-- ============ trade_chart_of_accounts (financeiro) ============
DROP POLICY IF EXISTS "Authenticated full access" ON public.trade_chart_of_accounts;

CREATE POLICY "trade_chart_of_accounts_select" ON public.trade_chart_of_accounts
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "trade_chart_of_accounts_insert" ON public.trade_chart_of_accounts
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "trade_chart_of_accounts_update" ON public.trade_chart_of_accounts
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "trade_chart_of_accounts_delete" ON public.trade_chart_of_accounts
FOR DELETE TO authenticated
USING (check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ fabrica_mp_cotacoes (fabrica) ============
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fabrica_mp_cotacoes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fabrica_mp_cotacoes', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "fabrica_mp_cotacoes_select" ON public.fabrica_mp_cotacoes
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "fabrica_mp_cotacoes_insert" ON public.fabrica_mp_cotacoes
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "fabrica_mp_cotacoes_update" ON public.fabrica_mp_cotacoes
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "fabrica_mp_cotacoes_delete" ON public.fabrica_mp_cotacoes
FOR DELETE TO authenticated
USING (check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_ordem_itens ============
DROP POLICY IF EXISTS "auth view china_ordem_itens" ON public.china_ordem_itens;
DROP POLICY IF EXISTS "auth insert china_ordem_itens" ON public.china_ordem_itens;
DROP POLICY IF EXISTS "auth update china_ordem_itens" ON public.china_ordem_itens;
DROP POLICY IF EXISTS "auth delete china_ordem_itens" ON public.china_ordem_itens;

CREATE POLICY "china_ordem_itens_select" ON public.china_ordem_itens
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_ordem_itens_insert" ON public.china_ordem_itens
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_ordem_itens_update" ON public.china_ordem_itens
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_ordem_itens_delete" ON public.china_ordem_itens
FOR DELETE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_embarques (SELECT + INSERT) ============
DROP POLICY IF EXISTS "Authenticated users can view embarques" ON public.china_embarques;
DROP POLICY IF EXISTS "Authenticated users can insert embarques" ON public.china_embarques;

CREATE POLICY "china_embarques_select" ON public.china_embarques
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_embarques_insert" ON public.china_embarques
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_embarque_itens ============
DROP POLICY IF EXISTS "auth view china_embarque_itens" ON public.china_embarque_itens;
DROP POLICY IF EXISTS "auth insert china_embarque_itens" ON public.china_embarque_itens;
DROP POLICY IF EXISTS "auth update china_embarque_itens" ON public.china_embarque_itens;
DROP POLICY IF EXISTS "auth delete china_embarque_itens" ON public.china_embarque_itens;

CREATE POLICY "china_embarque_itens_select" ON public.china_embarque_itens
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_embarque_itens_insert" ON public.china_embarque_itens
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_embarque_itens_update" ON public.china_embarque_itens
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_embarque_itens_delete" ON public.china_embarque_itens
FOR DELETE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_recebimentos_carga (SELECT + INSERT) ============
DROP POLICY IF EXISTS "auth view china_recebimentos_carga" ON public.china_recebimentos_carga;
DROP POLICY IF EXISTS "auth insert china_recebimentos_carga" ON public.china_recebimentos_carga;

CREATE POLICY "china_recebimentos_carga_select" ON public.china_recebimentos_carga
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_recebimentos_carga_insert" ON public.china_recebimentos_carga
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_recebimento_itens ============
DROP POLICY IF EXISTS "auth view china_recebimento_itens" ON public.china_recebimento_itens;
DROP POLICY IF EXISTS "auth insert china_recebimento_itens" ON public.china_recebimento_itens;
DROP POLICY IF EXISTS "auth update china_recebimento_itens" ON public.china_recebimento_itens;
DROP POLICY IF EXISTS "auth delete china_recebimento_itens" ON public.china_recebimento_itens;

CREATE POLICY "china_recebimento_itens_select" ON public.china_recebimento_itens
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_recebimento_itens_insert" ON public.china_recebimento_itens
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_recebimento_itens_update" ON public.china_recebimento_itens
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_recebimento_itens_delete" ON public.china_recebimento_itens
FOR DELETE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_oc_saldo_decisoes ============
DROP POLICY IF EXISTS "auth view china_saldo_dec" ON public.china_oc_saldo_decisoes;
DROP POLICY IF EXISTS "auth insert china_saldo_dec" ON public.china_oc_saldo_decisoes;
DROP POLICY IF EXISTS "auth update china_saldo_dec" ON public.china_oc_saldo_decisoes;

CREATE POLICY "china_oc_saldo_decisoes_select" ON public.china_oc_saldo_decisoes
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_oc_saldo_decisoes_insert" ON public.china_oc_saldo_decisoes
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_oc_saldo_decisoes_update" ON public.china_oc_saldo_decisoes
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_oc_custos (INSERT + UPDATE) ============
DROP POLICY IF EXISTS "auth insert china_oc_custos" ON public.china_oc_custos;
DROP POLICY IF EXISTS "auth update china_oc_custos" ON public.china_oc_custos;

CREATE POLICY "china_oc_custos_insert" ON public.china_oc_custos
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_oc_custos_update" ON public.china_oc_custos
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'financeiro') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));

-- ============ china_nao_conformidades ============
DROP POLICY IF EXISTS "auth view china_nc" ON public.china_nao_conformidades;
DROP POLICY IF EXISTS "auth insert china_nc" ON public.china_nao_conformidades;
DROP POLICY IF EXISTS "auth update china_nc" ON public.china_nao_conformidades;
DROP POLICY IF EXISTS "auth delete china_nc" ON public.china_nao_conformidades;

CREATE POLICY "china_nao_conformidades_select" ON public.china_nao_conformidades
FOR SELECT TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_nao_conformidades_insert" ON public.china_nao_conformidades
FOR INSERT TO authenticated
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_nao_conformidades_update" ON public.china_nao_conformidades
FOR UPDATE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
WITH CHECK (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "china_nao_conformidades_delete" ON public.china_nao_conformidades
FOR DELETE TO authenticated
USING (check_user_access(auth.uid(),'china') OR check_user_access(auth.uid(),'fabrica') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
