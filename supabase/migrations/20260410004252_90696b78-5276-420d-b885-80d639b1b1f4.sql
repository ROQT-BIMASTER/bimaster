
CREATE TABLE public.generated_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT,
  model_used TEXT NOT NULL DEFAULT 'google-veo-3',
  input_type TEXT NOT NULL DEFAULT 'text' CHECK (input_type IN ('text', 'image', 'document')),
  video_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  fal_request_id TEXT,
  duration INTEGER DEFAULT 5,
  aspect_ratio TEXT DEFAULT '16:9',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own videos"
  ON public.generated_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own videos"
  ON public.generated_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos"
  ON public.generated_videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos"
  ON public.generated_videos FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_generated_videos_updated_at
  BEFORE UPDATE ON public.generated_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
