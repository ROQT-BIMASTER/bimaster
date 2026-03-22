CREATE TABLE public.api_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id text NOT NULL,
  endpoint_path text NOT NULL,
  empresa_id text,
  user_id uuid NOT NULL,
  user_name text,
  message text NOT NULL,
  is_admin_reply boolean DEFAULT false,
  admin_user_id uuid,
  parent_id uuid REFERENCES public.api_support_messages(id) ON DELETE CASCADE,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.api_support_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert" ON public.api_support_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_update" ON public.api_support_messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_support_api ON public.api_support_messages(api_id, endpoint_path);
CREATE INDEX idx_support_status ON public.api_support_messages(status) WHERE status = 'open';
CREATE INDEX idx_support_user ON public.api_support_messages(user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.api_support_messages;