
-- Remover políticas SELECT redundantes que não filtram por tabela
DROP POLICY IF EXISTS "Pricing and sales can view product prices" ON fabrica_precos_produtos;
DROP POLICY IF EXISTS "fabrica_precos_produtos_select_final" ON fabrica_precos_produtos;

-- Manter apenas a política que usa user_can_access_price_table para filtrar por tabela
-- A política fabrica_precos_produtos_select_with_access já faz isso corretamente
