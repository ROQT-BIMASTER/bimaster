-- Drop the partially created objects from failed migration
DROP TABLE IF EXISTS public.trade_user_approval_levels CASCADE;
DROP FUNCTION IF EXISTS public.has_trade_admin_permission(UUID);

-- Create table to link users to approval levels
CREATE TABLE public.trade_user_approval_levels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES public.trade_approval_levels(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, level_id)
);

-- Add comment
COMMENT ON TABLE public.trade_user_approval_levels IS 'Links users to their approval authority levels in Trade Marketing';

-- Enable RLS
ALTER TABLE public.trade_user_approval_levels ENABLE ROW LEVEL SECURITY;

-- Create function to check if user has trade_admin permission
CREATE OR REPLACE FUNCTION public.has_trade_admin_permission(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM usuario_permissoes_telas upt
    JOIN telas_sistema ts ON ts.id = upt.tela_id
    WHERE upt.usuario_id = check_user_id 
      AND ts.codigo = 'trade_admin'
  )
$$;

-- RLS Policies
-- Select: Users with trade_admin permission can view all records
CREATE POLICY "Trade admins can view user approval levels"
ON public.trade_user_approval_levels
FOR SELECT
TO authenticated
USING (
  public.has_trade_admin_permission(auth.uid()) OR user_id = auth.uid()
);

-- Insert: Only trade_admin can insert
CREATE POLICY "Trade admins can insert user approval levels"
ON public.trade_user_approval_levels
FOR INSERT
TO authenticated
WITH CHECK (public.has_trade_admin_permission(auth.uid()));

-- Update: Only trade_admin can update
CREATE POLICY "Trade admins can update user approval levels"
ON public.trade_user_approval_levels
FOR UPDATE
TO authenticated
USING (public.has_trade_admin_permission(auth.uid()));

-- Delete: Only trade_admin can delete
CREATE POLICY "Trade admins can delete user approval levels"
ON public.trade_user_approval_levels
FOR DELETE
TO authenticated
USING (public.has_trade_admin_permission(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_trade_user_approval_levels_updated_at
BEFORE UPDATE ON public.trade_user_approval_levels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_trade_user_approval_levels_user ON public.trade_user_approval_levels(user_id);
CREATE INDEX idx_trade_user_approval_levels_level ON public.trade_user_approval_levels(level_id);
CREATE INDEX idx_trade_user_approval_levels_active ON public.trade_user_approval_levels(is_active) WHERE is_active = true;