
-- 1. products: restringir SELECT
CREATE POLICY "products_select_restricted"
ON public.products FOR SELECT
TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuario_permissoes_modulos upm
    JOIN public.modulos_sistema m ON m.id = upm.modulo_id
    WHERE upm.usuario_id = auth.uid() AND m.codigo IN ('fabrica', 'financeiro', 'trade')
  )
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.vendedor_id = auth.uid()
  )
);

-- 2. Storage: policies para authenticated only
CREATE POLICY "fabrica_fotos_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY "email_assets_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'email-assets');

-- 3. Remover tabelas sensíveis do Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_payment_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.meetings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.internal_tickets; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
