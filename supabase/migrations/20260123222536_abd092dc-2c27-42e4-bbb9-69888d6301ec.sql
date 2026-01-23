-- Criar bucket para evidências de campanhas
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-evidence', 'campaign-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para evidências
CREATE POLICY "campaign_evidence_select" ON storage.objects 
  FOR SELECT TO authenticated USING (bucket_id = 'campaign-evidence');

CREATE POLICY "campaign_evidence_insert" ON storage.objects 
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-evidence');

CREATE POLICY "campaign_evidence_update" ON storage.objects 
  FOR UPDATE TO authenticated USING (bucket_id = 'campaign-evidence');

CREATE POLICY "campaign_evidence_delete" ON storage.objects 
  FOR DELETE TO authenticated USING (bucket_id = 'campaign-evidence');