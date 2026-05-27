-- Harden access to vendas_union / Union
--
-- Contexto: o brief original pediu ENABLE RLS + CREATE POLICY em
-- public.vendas_union. Investigação mostrou que vendas_union é uma VIEW com
-- security_invoker=true sobre public."Union" — Postgres não permite RLS nem
-- policies em views. A proteção real vive na tabela base "Union", que já tem
-- RLS habilitada com policies para admin, empresa, supervisor e vendedor.
--
-- O problema concreto é que anon e authenticated tinham GRANTs amplos
-- (arwdDxtm) tanto na view quanto na tabela base. RLS bloqueia leitura
-- indevida, mas o excesso de privilégio é ruído de auditoria e habilitaria
-- escrita anônima caso alguém remova RLS no futuro. Esta migration:
--   1. Reforça grants: anon perde tudo; authenticated fica só com SELECT;
--      service_role mantém ALL.
--   2. Garante RLS ativa e FORCE em "Union" (idempotente / defensivo).
--   3. Adiciona policy de leitura para o role 'comercial' (se existir no
--      enum app_role), conforme pedido no brief.
--   4. Documenta a decisão em COMMENT ON VIEW.

REVOKE ALL ON public."Union"        FROM anon;
REVOKE ALL ON public.vendas_union   FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Union"      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vendas_union FROM authenticated;

GRANT SELECT ON public."Union"      TO authenticated;
GRANT SELECT ON public.vendas_union TO authenticated;

GRANT ALL ON public."Union"      TO service_role;
GRANT ALL ON public.vendas_union TO service_role;

ALTER TABLE public."Union" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Union" FORCE  ROW LEVEL SECURITY;

-- Policy adicional para 'comercial' — só cria se o valor existir no enum.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'comercial'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'Union'
      AND policyname = 'comercial_vendas_full_read'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "comercial_vendas_full_read" ON public."Union"
        FOR SELECT TO authenticated
        USING (public.has_role((SELECT auth.uid()), 'comercial'::app_role))
    $p$;
  END IF;
END $$;

COMMENT ON VIEW public.vendas_union IS
  'View security_invoker sobre public."Union". Proteção real (RLS) vive na '
  'tabela base. authenticated tem apenas SELECT; anon não tem privilégios. '
  'Não criar policies aqui — views não suportam RLS no Postgres.';