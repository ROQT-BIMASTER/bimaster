
CREATE TABLE public.sandbox_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_body jsonb,
  response_body jsonb,
  response_status int DEFAULT 200,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sandbox_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sandbox requests"
  ON public.sandbox_requests FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
