
-- REVOKE all anon access from sensitive tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.contas_receber FROM anon;
REVOKE ALL ON public.contas_pagar FROM anon;
REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.clientes_perfil_credito FROM anon;
REVOKE ALL ON public.prospects FROM anon;
REVOKE ALL ON public.stores FROM anon;
REVOKE ALL ON public.sales FROM anon;
REVOKE ALL ON public.trade_budgets FROM anon;
REVOKE ALL ON public.trade_investments FROM anon;
REVOKE ALL ON public.fabrica_produtos FROM anon;
REVOKE ALL ON public.fabrica_formulas FROM anon;
REVOKE ALL ON public.fabrica_precos_produtos FROM anon;
REVOKE ALL ON public.fabrica_tabelas_preco FROM anon;
REVOKE ALL ON public.ads_accounts FROM anon;
REVOKE ALL ON public.user_whatsapp FROM anon;
REVOKE ALL ON public.cobrancas_enviadas FROM anon;
REVOKE ALL ON public.fila_cobrancas FROM anon;

-- Remove public-accessible RLS policies from contas_pagar
DROP POLICY IF EXISTS "contas_pagar_select" ON public.contas_pagar;

-- Remove public-accessible RLS policies from clientes 
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;

-- Remove public-accessible RLS policies from clientes_perfil_credito
DROP POLICY IF EXISTS "clientes_perfil_credito_select" ON public.clientes_perfil_credito;

-- Remove public-accessible RLS policies from prospects
DROP POLICY IF EXISTS "prospects_select" ON public.prospects;

-- Remove public-accessible RLS policies from stores
DROP POLICY IF EXISTS "stores_select" ON public.stores;

-- Remove public-accessible RLS policies from sales
DROP POLICY IF EXISTS "sales_select" ON public.sales;

-- Remove public-accessible RLS policies from trade_budgets
DROP POLICY IF EXISTS "trade_budgets_select" ON public.trade_budgets;

-- Remove public-accessible RLS policies from trade_investments
DROP POLICY IF EXISTS "trade_investments_select" ON public.trade_investments;

-- Remove public-accessible RLS policies from fabrica tables
DROP POLICY IF EXISTS "fabrica_produtos_select" ON public.fabrica_produtos;
DROP POLICY IF EXISTS "fabrica_formulas_select" ON public.fabrica_formulas;
DROP POLICY IF EXISTS "fabrica_precos_produtos_select" ON public.fabrica_precos_produtos;
DROP POLICY IF EXISTS "fabrica_tabelas_preco_select" ON public.fabrica_tabelas_preco;

-- Remove public-accessible RLS policies from other sensitive tables
DROP POLICY IF EXISTS "ads_accounts_select" ON public.ads_accounts;
DROP POLICY IF EXISTS "user_whatsapp_select" ON public.user_whatsapp;
DROP POLICY IF EXISTS "cobrancas_enviadas_select" ON public.cobrancas_enviadas;
DROP POLICY IF EXISTS "fila_cobrancas_select" ON public.fila_cobrancas;
