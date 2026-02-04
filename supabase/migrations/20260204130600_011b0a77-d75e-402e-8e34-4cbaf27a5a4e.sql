-- =========================================================
-- CORREÇÃO: Acesso Indevido a Fotos - Hierarquia e RLS
-- Problema: Juliana (vendedora) vendo fotos de Jessika (supervisora)
-- =========================================================

-- 1. REMOVER POLICIES DE STORAGE EXCESSIVAMENTE PERMISSIVAS
-- Essas policies permitem acesso irrestrito ao bucket trade-photos
DROP POLICY IF EXISTS "Fotos são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Todos podem ver fotos trade" ON storage.objects;

-- 2. CRIAR POLICY DE STORAGE COM HIERARQUIA CORRETA
-- Nova policy que respeita: dono da foto, supervisor do dono, ou admin global
CREATE POLICY "Trade photos hierarquia correta" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-photos' 
  AND (
    -- Admin ou supervisor global pode ver tudo
    is_admin_or_supervisor(auth.uid())
    -- OU verificação via tabela photos
    OR EXISTS (
      SELECT 1 FROM public.photos p
      WHERE p.photo_url LIKE '%' || objects.name || '%'
      AND (
        -- É dono da foto
        p.vendedor_id = auth.uid()
        -- OU é o supervisor direto registrado
        OR p.supervisor_id = auth.uid()
        -- OU é supervisor na hierarquia do vendedor
        OR is_supervisor_of(p.vendedor_id, auth.uid())
      )
    )
  )
);

-- 3. CORRIGIR POLICY DA TABELA PHOTOS - Supervisores
-- ANTES: is_supervisor_of(auth.uid(), vendedor_id) - INVERTIDO!
-- DEPOIS: is_supervisor_of(vendedor_id, auth.uid()) - CORRETO
DROP POLICY IF EXISTS "Supervisores podem ver fotos de seus subordinados" ON public.photos;

CREATE POLICY "Supervisores podem ver fotos de subordinados" ON public.photos
FOR SELECT TO authenticated
USING (
  supervisor_id IS NOT NULL
  AND is_supervisor_of(vendedor_id, auth.uid())
);

-- 4. CORRIGIR POLICY "Usuários veem fotos permitidas"
-- Garantir que a hierarquia está correta em todas as verificações
DROP POLICY IF EXISTS "Usuários veem fotos permitidas" ON public.photos;

CREATE POLICY "Usuários veem fotos permitidas" ON public.photos
FOR SELECT TO authenticated
USING (
  -- É o próprio vendedor (dono da foto)
  vendedor_id = auth.uid()
  -- OU é o supervisor direto registrado na foto
  OR supervisor_id = auth.uid()
  -- OU é admin/supervisor global
  OR is_admin_or_supervisor(auth.uid())
  -- OU tem acesso via visita
  OR EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.id = photos.visit_id 
    AND (
      v.user_id = auth.uid()
      OR is_supervisor_of(v.user_id, auth.uid())
    )
  )
);