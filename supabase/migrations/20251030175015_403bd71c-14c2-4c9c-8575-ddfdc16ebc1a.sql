-- Criar bucket para fotos do guia de medição (caso não exista)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-photos', 'trade-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
DO $$
BEGIN
  -- Política para visualização pública
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Todos podem ver fotos trade'
  ) THEN
    CREATE POLICY "Todos podem ver fotos trade"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'trade-photos');
  END IF;

  -- Política para upload (usuários autenticados)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem fazer upload'
  ) THEN
    CREATE POLICY "Usuários autenticados podem fazer upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'trade-photos' AND auth.role() = 'authenticated');
  END IF;

  -- Política para atualização
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Criadores podem atualizar fotos trade'
  ) THEN
    CREATE POLICY "Criadores podem atualizar fotos trade"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'trade-photos' AND auth.uid() = owner);
  END IF;

  -- Política para deleção (apenas admins/supervisores)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins podem deletar fotos trade'
  ) THEN
    CREATE POLICY "Admins podem deletar fotos trade"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'trade-photos' AND is_admin_or_supervisor(auth.uid()));
  END IF;
END $$;
