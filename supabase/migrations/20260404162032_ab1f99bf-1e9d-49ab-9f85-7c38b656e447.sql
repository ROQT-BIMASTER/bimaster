
-- SELECT para todos autenticados
CREATE POLICY "Authenticated can read mappings"
  ON plano_contas_mapeamento_categorias FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE para admin/supervisor
CREATE POLICY "Admins and supervisors can insert mappings"
  ON plano_contas_mapeamento_categorias FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Admins and supervisors can update mappings"
  ON plano_contas_mapeamento_categorias FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Admins and supervisors can delete mappings"
  ON plano_contas_mapeamento_categorias FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
