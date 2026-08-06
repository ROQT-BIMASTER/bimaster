CREATE POLICY "novidades_midia_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'novidades-midia');

CREATE POLICY "novidades_midia_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'novidades-midia' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "novidades_midia_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'novidades-midia' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'novidades-midia' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "novidades_midia_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'novidades-midia' AND public.has_role(auth.uid(), 'admin'));