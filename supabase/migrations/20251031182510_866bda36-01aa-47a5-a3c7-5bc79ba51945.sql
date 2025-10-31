-- Create audit log table for API access tracking
CREATE TABLE IF NOT EXISTS public.api_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint varchar(255) NOT NULL,
  ip_address varchar(45),
  user_agent text,
  success boolean NOT NULL,
  error_message text,
  record_count integer,
  format varchar(10),
  include_photos boolean,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_api_access_log_endpoint ON public.api_access_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_access_log_requested_at ON public.api_access_log(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_log_ip ON public.api_access_log(ip_address) WHERE success = false;

-- Enable RLS
ALTER TABLE public.api_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Apenas admins podem visualizar logs de API"
ON public.api_access_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));