
-- Table for API keys metadata management
CREATE TABLE public.api_keys_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL UNIQUE,
  description text,
  masked_value text DEFAULT '****',
  is_active boolean NOT NULL DEFAULT true,
  last_rotated_at timestamptz,
  rotated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys_management ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy
CREATE POLICY "Admins can view api keys"
  ON public.api_keys_management
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin-only update policy
CREATE POLICY "Admins can update api keys"
  ON public.api_keys_management
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin-only insert policy
CREATE POLICY "Admins can insert api keys"
  ON public.api_keys_management
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with current 14 system keys
INSERT INTO public.api_keys_management (key_name, description, masked_value, is_active) VALUES
  ('CNPJBIZ_API_KEY', 'API de consulta CNPJ (CNPJBiz)', '****', true),
  ('ELEVENLABS_API_KEY', 'Text-to-Speech (ElevenLabs)', '****', true),
  ('EXPORT_API_KEY', 'Chave de autenticação para exportações', '****', true),
  ('GOOGLE_PLACES_API_KEY', 'Google Places e Geocoding', '****', true),
  ('LOVABLE_API_KEY', 'Integração Lovable AI', '****', true),
  ('MAPBOX_ACCESS_TOKEN', 'Mapbox para mapas', '****', true),
  ('N8N', 'Webhook N8N principal', '****', true),
  ('N8N_API_KEY', 'Autenticação N8N API', '****', true),
  ('OPENAI_API_KEY', 'OpenAI GPT models', '****', true),
  ('POLLO_API_KEY', 'Integração Pollo', '****', true),
  ('QUEUE_PROCESSOR_SECRET', 'Secret para processador de filas', '****', true),
  ('RESEND_API_KEY', 'Envio de emails (Resend)', '****', true),
  ('STRIPE_SECRET_KEY', 'Pagamentos Stripe', '****', true),
  ('SUPABASE_SERVICE_ROLE_KEY', 'Chave administrativa do backend', '****', true);
