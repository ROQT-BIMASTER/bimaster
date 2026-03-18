
-- 1. Convert ALL public buckets to private
UPDATE storage.buckets SET public = false WHERE id IN (
  'amostras', 'aprovacao-artes', 'email-assets', 'embalagem-analise',
  'etiqueta-bula', 'fluxo-artes', 'marketing-assets', 'produto-brasil-imagens'
);

-- 2. Create visibility audit log table
CREATE TABLE IF NOT EXISTS public.visibility_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'bucket', 'table', 'record'
  entity_name text NOT NULL,
  entity_id text,
  old_visibility text NOT NULL, -- 'private' or 'public'  
  new_visibility text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visibility_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view visibility audit logs"
  ON public.visibility_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can insert audit logs  
CREATE POLICY "Admins can insert visibility audit logs"
  ON public.visibility_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Create a function to safely change bucket visibility (admin only)
CREATE OR REPLACE FUNCTION public.change_bucket_visibility(
  p_bucket_id text,
  p_make_public boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_old_public boolean;
  v_user_id uuid;
  v_user_name text;
BEGIN
  v_user_id := auth.uid();
  
  -- Check admin role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem alterar visibilidade');
  END IF;

  -- Get current state
  SELECT public INTO v_old_public FROM storage.buckets WHERE id = p_bucket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bucket não encontrado');
  END IF;

  -- Get user name
  SELECT nome INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  -- Update bucket
  UPDATE storage.buckets SET public = p_make_public WHERE id = p_bucket_id;

  -- Log the change
  INSERT INTO public.visibility_audit_log (entity_type, entity_name, old_visibility, new_visibility, changed_by, changed_by_name, reason)
  VALUES (
    'bucket',
    p_bucket_id,
    CASE WHEN v_old_public THEN 'public' ELSE 'private' END,
    CASE WHEN p_make_public THEN 'public' ELSE 'private' END,
    v_user_id,
    v_user_name,
    p_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'bucket', p_bucket_id,
    'old_visibility', CASE WHEN v_old_public THEN 'public' ELSE 'private' END,
    'new_visibility', CASE WHEN p_make_public THEN 'public' ELSE 'private' END
  );
END;
$$;
