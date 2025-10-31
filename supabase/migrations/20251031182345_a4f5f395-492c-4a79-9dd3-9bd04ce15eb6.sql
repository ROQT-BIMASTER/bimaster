-- ============================================
-- Security Fix: Strengthen RLS and fix missing policies
-- Addresses 2 security findings:
-- 1. DEFINER_OR_RPC_BYPASS: Ensure trade_bank_transactions has proper RLS
-- 2. MISSING_RLS: Add RLS policies to vendor_availability table
-- ============================================

-- 1. VERIFY AND STRENGTHEN trade_bank_transactions RLS
-- Check if table exists and ensure RLS is enabled
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trade_bank_transactions') THEN
    -- Ensure RLS is enabled
    ALTER TABLE public.trade_bank_transactions ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist to recreate them properly
    DROP POLICY IF EXISTS "Admins gerenciam todas transações" ON public.trade_bank_transactions;
    DROP POLICY IF EXISTS "Usuários veem transações relacionadas" ON public.trade_bank_transactions;
    DROP POLICY IF EXISTS "Apenas admins podem inserir transações bancárias" ON public.trade_bank_transactions;
    DROP POLICY IF EXISTS "Apenas admins podem atualizar transações" ON public.trade_bank_transactions;
    DROP POLICY IF EXISTS "Apenas admins podem deletar transações" ON public.trade_bank_transactions;
    DROP POLICY IF EXISTS "Usuários veem transações autorizadas" ON public.trade_bank_transactions;
    
    -- Create comprehensive RLS policies
    -- Policy 1: Only admin/supervisor can INSERT bank transactions
    CREATE POLICY "Apenas admins e supervisores podem inserir transações bancárias"
    ON public.trade_bank_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin_or_supervisor(auth.uid()));
    
    -- Policy 2: Only admin/supervisor can UPDATE bank transactions
    CREATE POLICY "Apenas admins e supervisores podem atualizar transações"
    ON public.trade_bank_transactions
    FOR UPDATE
    TO authenticated
    USING (is_admin_or_supervisor(auth.uid()))
    WITH CHECK (is_admin_or_supervisor(auth.uid()));
    
    -- Policy 3: Only admin can DELETE bank transactions
    CREATE POLICY "Apenas admins podem deletar transações bancárias"
    ON public.trade_bank_transactions
    FOR DELETE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'));
    
    -- Policy 4: Only admin/supervisor can view bank transactions
    -- (Bank transactions are sensitive financial data)
    CREATE POLICY "Apenas admins e supervisores veem transações bancárias"
    ON public.trade_bank_transactions
    FOR SELECT
    TO authenticated
    USING (is_admin_or_supervisor(auth.uid()));
    
    RAISE NOTICE '✅ RLS policies for trade_bank_transactions updated successfully';
  ELSE
    RAISE NOTICE 'ℹ️ Table trade_bank_transactions does not exist';
  END IF;
END $$;

-- 2. ADD RLS POLICIES TO vendor_availability TABLE
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vendor_availability') THEN
    -- Ensure RLS is enabled
    ALTER TABLE public.vendor_availability ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Vendedores gerenciam sua disponibilidade" ON public.vendor_availability;
    DROP POLICY IF EXISTS "Admins visualizam toda disponibilidade" ON public.vendor_availability;
    DROP POLICY IF EXISTS "Admins gerenciam toda disponibilidade" ON public.vendor_availability;
    DROP POLICY IF EXISTS "Admins e supervisores visualizam toda disponibilidade" ON public.vendor_availability;
    DROP POLICY IF EXISTS "Admins e supervisores gerenciam toda disponibilidade" ON public.vendor_availability;
    
    -- Policy 1: Vendedores can manage their own availability (SELECT, INSERT, UPDATE, DELETE)
    CREATE POLICY "Vendedores gerenciam sua disponibilidade"
    ON public.vendor_availability
    FOR ALL
    TO authenticated
    USING (vendedor_id = auth.uid())
    WITH CHECK (vendedor_id = auth.uid());
    
    -- Policy 2: Admins and supervisors can view all availability
    CREATE POLICY "Admins e supervisores visualizam toda disponibilidade"
    ON public.vendor_availability
    FOR SELECT
    TO authenticated
    USING (is_admin_or_supervisor(auth.uid()));
    
    -- Policy 3: Admins and supervisors can manage all availability
    CREATE POLICY "Admins e supervisores gerenciam toda disponibilidade"
    ON public.vendor_availability
    FOR ALL
    TO authenticated
    USING (is_admin_or_supervisor(auth.uid()))
    WITH CHECK (is_admin_or_supervisor(auth.uid()));
    
    RAISE NOTICE '✅ RLS policies for vendor_availability created successfully';
  ELSE
    RAISE NOTICE 'ℹ️ Table vendor_availability does not exist';
  END IF;
END $$;