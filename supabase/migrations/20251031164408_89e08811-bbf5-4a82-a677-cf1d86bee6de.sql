-- Adicionar coluna para banner URL na tabela trade_rewards
ALTER TABLE trade_rewards ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Criar bucket para banners de premiações se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('reward-banners', 'reward-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o bucket reward-banners
CREATE POLICY "Admins podem fazer upload de banners de premiação"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reward-banners' AND
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins podem atualizar banners de premiação"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reward-banners' AND
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins podem deletar banners de premiação"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reward-banners' AND
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Banners de premiação são públicos para leitura"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'reward-banners');