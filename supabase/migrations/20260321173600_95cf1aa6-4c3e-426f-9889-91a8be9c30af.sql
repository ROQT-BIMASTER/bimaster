-- Migration 1: RLS nas 6 tabelas de lookup

-- bancos
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bancos FROM anon;
CREATE POLICY "lookup_select_bancos" ON public.bancos FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_admin_insert_bancos" ON public.bancos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lookup_admin_update_bancos" ON public.bancos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- bandeiras_cartao
ALTER TABLE public.bandeiras_cartao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bandeiras_cartao FROM anon;
CREATE POLICY "lookup_select_bandeiras" ON public.bandeiras_cartao FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_admin_insert_bandeiras" ON public.bandeiras_cartao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lookup_admin_update_bandeiras" ON public.bandeiras_cartao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- finalidades_transferencia
ALTER TABLE public.finalidades_transferencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finalidades_transferencia FROM anon;
CREATE POLICY "lookup_select_finalidades" ON public.finalidades_transferencia FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_admin_insert_finalidades" ON public.finalidades_transferencia FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lookup_admin_update_finalidades" ON public.finalidades_transferencia FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- origens_titulo
ALTER TABLE public.origens_titulo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.origens_titulo FROM anon;
CREATE POLICY "lookup_select_origens" ON public.origens_titulo FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_admin_insert_origens" ON public.origens_titulo FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lookup_admin_update_origens" ON public.origens_titulo FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- tipos_conta_corrente
ALTER TABLE public.tipos_conta_corrente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tipos_conta_corrente FROM anon;
CREATE POLICY "lookup_select_tipos_cc" ON public.tipos_conta_corrente FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_admin_insert_tipos_cc" ON public.tipos_conta_corrente FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lookup_admin_update_tipos_cc" ON public.tipos_conta_corrente FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- tipos_documento
ALTER TABLE public.tipos_documento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tipos_documento FROM anon;
CREATE POLICY "lookup_select_tipos_doc" ON public.tipos_documento FOR SELECT TO authenticated USING (true);
CREATE POLICY "lookup_admin_insert_tipos_doc" ON public.tipos_documento FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "lookup_admin_update_tipos_doc" ON public.tipos_documento FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
