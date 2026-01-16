
-- ================================================================
-- CORREÇÃO: Permitir que usuários com permissão ao módulo 'precos' 
-- vejam as tabelas de preço
-- ================================================================

-- Remover política SELECT antiga que só considera CNPJ
DROP POLICY IF EXISTS "Usuários veem tabelas do seu CNPJ ou que criaram" ON public.fabrica_tabelas_preco;
DROP POLICY IF EXISTS "Admin e supervisor podem ver todas tabelas" ON public.fabrica_tabelas_preco;

-- Nova política SELECT que considera: admin/supervisor OU permissão ao módulo precos OU CNPJ
CREATE POLICY "fabrica_tabelas_preco_select" ON public.fabrica_tabelas_preco
FOR SELECT TO authenticated
USING (
  -- Admin e supervisor veem tudo
  is_admin_or_supervisor(auth.uid())
  OR
  -- Usuários com permissão ao módulo precos veem tudo
  usuario_tem_permissao_modulo(auth.uid(), 'precos'::text)
  OR
  -- Usuários veem tabelas do seu CNPJ, ou visíveis para seu CNPJ, ou que criaram
  (
    owner_cnpj IS NULL 
    OR owner_cnpj::text IN (SELECT cnpj FROM user_cnpj WHERE user_id = auth.uid())
    OR auth.uid() IN (SELECT user_id FROM user_cnpj WHERE cnpj::text = ANY(fabrica_tabelas_preco.visivel_para_cnpjs))
    OR created_by = auth.uid()
  )
);

-- Mesma correção para fabrica_precos_produtos - permitir módulo precos
DROP POLICY IF EXISTS "Usuários com permissão fabrica veem preços de produtos" ON public.fabrica_precos_produtos;

CREATE POLICY "fabrica_precos_produtos_select" ON public.fabrica_precos_produtos
FOR SELECT TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
  OR
  usuario_tem_permissao_modulo(auth.uid(), 'precos'::text)
  OR
  usuario_tem_permissao_modulo(auth.uid(), 'fabrica'::text)
);
