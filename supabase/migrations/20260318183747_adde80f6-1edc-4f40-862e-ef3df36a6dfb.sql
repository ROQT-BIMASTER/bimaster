-- RLS policies for ddos_rate_limits (admin-only SELECT, no public DML)
CREATE POLICY "admin_select_ddos_rate_limits" ON public.ddos_rate_limits
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "deny_insert_ddos_rate_limits" ON public.ddos_rate_limits
FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "deny_update_ddos_rate_limits" ON public.ddos_rate_limits
FOR UPDATE TO authenticated USING (false);

CREATE POLICY "deny_delete_ddos_rate_limits" ON public.ddos_rate_limits
FOR DELETE TO authenticated USING (false);

-- RLS policies for login_attempts (admin-only SELECT, no public DML)
CREATE POLICY "admin_select_login_attempts" ON public.login_attempts
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "deny_insert_login_attempts" ON public.login_attempts
FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "deny_update_login_attempts" ON public.login_attempts
FOR UPDATE TO authenticated USING (false);

CREATE POLICY "deny_delete_login_attempts" ON public.login_attempts
FOR DELETE TO authenticated USING (false);