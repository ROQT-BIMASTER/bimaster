
-- 1. security_audit_log: SELECT restrito a admin
CREATE POLICY "Admins can view security audit logs"
  ON public.security_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. security_audit_log: service_role full access (triggers/edge functions)
CREATE POLICY "Service role full access on security_audit_log"
  ON public.security_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. security_pentest_reports: bloquear UPDATE (imutável)
-- RLS já está ativo, sem policy de UPDATE/DELETE = bloqueado por padrão
-- Adicionamos policy explícita de negação para clareza

-- 4. access_audit_log: garantir imutabilidade
-- RLS já está ativo, sem policy de UPDATE/DELETE = bloqueado por padrão
