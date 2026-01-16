
-- =====================================================
-- CORREÇÃO COMPLETA DE SEGURANÇA - TABELAS RESTANTES
-- =====================================================

-- STORES - Acesso baseado em atribuição de loja
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view stores based on role" ON public.stores;
DROP POLICY IF EXISTS "Users can view assigned stores" ON public.stores;

CREATE POLICY "Users can view stores based on role"
ON public.stores FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Admins can insert stores"
ON public.stores FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can update stores"
ON public.stores FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete stores"
ON public.stores FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- FABRICA_PRODUTOS - Apenas fábrica, preços, admin
ALTER TABLE public.fabrica_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.fabrica_produtos;
DROP POLICY IF EXISTS "Factory and admins can view products" ON public.fabrica_produtos;

CREATE POLICY "Factory and pricing can view products"
ON public.fabrica_produtos FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Factory and admins can insert products"
ON public.fabrica_produtos FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory and admins can update products"
ON public.fabrica_produtos FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Admins can delete products"
ON public.fabrica_produtos FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- FABRICA_FORMULA_ITENS - Apenas fábrica, admin
ALTER TABLE public.fabrica_formula_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view formula items" ON public.fabrica_formula_itens;

CREATE POLICY "Factory and pricing can view formula items"
ON public.fabrica_formula_itens FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Factory can insert formula items"
ON public.fabrica_formula_itens FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory can update formula items"
ON public.fabrica_formula_itens FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory can delete formula items"
ON public.fabrica_formula_itens FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- FABRICA_TABELAS_PRECO - Apenas preços, vendas, admin
ALTER TABLE public.fabrica_tabelas_preco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view price tables" ON public.fabrica_tabelas_preco;

CREATE POLICY "Pricing and sales can view price tables"
ON public.fabrica_tabelas_preco FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Pricing can insert price tables"
ON public.fabrica_tabelas_preco FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Pricing can update price tables"
ON public.fabrica_tabelas_preco FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'precos')
);

CREATE POLICY "Admins can delete price tables"
ON public.fabrica_tabelas_preco FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- FABRICA_FORNECEDORES - Apenas fábrica, compras, admin
ALTER TABLE public.fabrica_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.fabrica_fornecedores;

CREATE POLICY "Factory and purchasing can view suppliers"
ON public.fabrica_fornecedores FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'compras')
);

CREATE POLICY "Factory can insert suppliers"
ON public.fabrica_fornecedores FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory can update suppliers"
ON public.fabrica_fornecedores FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Admins can delete suppliers"
ON public.fabrica_fornecedores FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- FABRICA_NOTAS_FISCAIS - Apenas fábrica, financeiro, admin
ALTER TABLE public.fabrica_notas_fiscais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.fabrica_notas_fiscais;

CREATE POLICY "Factory and finance can view invoices"
ON public.fabrica_notas_fiscais FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Factory can insert invoices"
ON public.fabrica_notas_fiscais FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory can update invoices"
ON public.fabrica_notas_fiscais FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Admins can delete invoices"
ON public.fabrica_notas_fiscais FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- FABRICA_ITENS_NF - Apenas fábrica, financeiro, admin
ALTER TABLE public.fabrica_itens_nf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view invoice items" ON public.fabrica_itens_nf;

CREATE POLICY "Factory and finance can view invoice items"
ON public.fabrica_itens_nf FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Factory can insert invoice items"
ON public.fabrica_itens_nf FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Factory can update invoice items"
ON public.fabrica_itens_nf FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "Admins can delete invoice items"
ON public.fabrica_itens_nf FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- Revogar acesso anônimo
REVOKE ALL ON public.stores FROM anon;
REVOKE ALL ON public.fabrica_produtos FROM anon;
REVOKE ALL ON public.fabrica_formula_itens FROM anon;
REVOKE ALL ON public.fabrica_tabelas_preco FROM anon;
REVOKE ALL ON public.fabrica_fornecedores FROM anon;
REVOKE ALL ON public.fabrica_notas_fiscais FROM anon;
REVOKE ALL ON public.fabrica_itens_nf FROM anon;
