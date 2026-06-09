-- PR-D1a: habilita escrita admin em rr_produtos/rr_linhas/rr_variantes + coluna origem

-- 1. Coluna de origem (provenance: 'notion' vs criado no app)
-- Nota: rr_linhas já possui coluna `origem` (vinda da prop Notion "Origem"). IF NOT EXISTS faz no-op nela.
ALTER TABLE public.rr_produtos  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'notion';
ALTER TABLE public.rr_linhas    ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'notion';
ALTER TABLE public.rr_variantes ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'notion';

-- 2. GRANTs de escrita (SELECT já existe)
GRANT INSERT, UPDATE, DELETE ON public.rr_produtos  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rr_linhas    TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rr_variantes TO authenticated;

-- 3. Policies de escrita — apenas admin (refinar role depois)
CREATE POLICY "rr_produtos_write"  ON public.rr_produtos  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_produtos_upd"    ON public.rr_produtos  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_produtos_del"    ON public.rr_produtos  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "rr_linhas_write"    ON public.rr_linhas    FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_linhas_upd"      ON public.rr_linhas    FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_linhas_del"      ON public.rr_linhas    FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "rr_variantes_write" ON public.rr_variantes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_variantes_upd"   ON public.rr_variantes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_variantes_del"   ON public.rr_variantes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));