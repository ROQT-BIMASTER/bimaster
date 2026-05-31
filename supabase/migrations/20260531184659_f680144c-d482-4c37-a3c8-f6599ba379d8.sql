
-- Soft delete + lixeira de 30 dias para projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_projetos_deleted_at ON public.projetos(deleted_at) WHERE deleted_at IS NOT NULL;

-- Esconde projetos soft-deletados das listagens normais
DROP POLICY IF EXISTS "Users view accessible projects" ON public.projetos;
CREATE POLICY "Users view accessible projects" ON public.projetos
FOR SELECT
USING (user_can_access_projeto((SELECT auth.uid()), id) AND deleted_at IS NULL);

-- Admins podem ver os projetos na lixeira
DROP POLICY IF EXISTS "Admins view deleted projects" ON public.projetos;
CREATE POLICY "Admins view deleted projects" ON public.projetos
FOR SELECT
USING (deleted_at IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

-- RPC: restaurar projeto (apenas admin). A senha é re-verificada no front
-- via verifyCurrentUserPassword antes de chamar esta RPC.
CREATE OR REPLACE FUNCTION public.rpc_restaurar_projeto(_projeto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar projetos';
  END IF;
  UPDATE public.projetos
     SET deleted_at = NULL,
         updated_at = now()
   WHERE id = _projeto_id
     AND deleted_at IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_restaurar_projeto(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_restaurar_projeto(uuid) TO authenticated;

-- RPC: purga definitivamente projetos com mais de 30 dias na lixeira
CREATE OR REPLACE FUNCTION public.rpc_purge_projetos_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM public.projetos
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_purge_projetos_expirados() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_purge_projetos_expirados() TO service_role;

-- Agendamento diário (03:15) via pg_cron, se disponível
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'purge-projetos-lixeira';
    PERFORM cron.schedule(
      'purge-projetos-lixeira',
      '15 3 * * *',
      $cron$ SELECT public.rpc_purge_projetos_expirados(); $cron$
    );
  END IF;
END $$;
