-- Criar tabela para fila de análise de fotos (performance otimizada)
CREATE TABLE IF NOT EXISTS public.photo_analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS na fila
ALTER TABLE public.photo_analysis_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários veem apenas suas próprias análises
CREATE POLICY "Users view own analysis queue"
ON public.photo_analysis_queue
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  (public.has_role(auth.uid(), 'supervisor') AND public.is_supervisor_of(auth.uid(), created_by))
);

-- Policy: Usuários podem inserir na fila
CREATE POLICY "Users can insert to analysis queue"
ON public.photo_analysis_queue
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Policy: Sistema pode atualizar status
CREATE POLICY "System can update queue"
ON public.photo_analysis_queue
FOR UPDATE
TO authenticated
USING (true);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_photo_analysis_queue_status ON public.photo_analysis_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_photo_analysis_queue_created_by ON public.photo_analysis_queue(created_by);
CREATE INDEX IF NOT EXISTS idx_photo_analysis_queue_created_at ON public.photo_analysis_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_vendedor ON public.photos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_photos_store ON public.photos(store_id);
CREATE INDEX IF NOT EXISTS idx_photos_visit ON public.photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_photos_ai_processed ON public.photos(ai_processed) WHERE ai_processed = false;