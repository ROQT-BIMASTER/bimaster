
CREATE OR REPLACE FUNCTION public.can_access_payment_queue(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN departamentos d ON p.departamento_id = d.id
    WHERE p.id = _user_id 
    AND (
      d.nome ILIKE '%Financeiro%' 
      OR d.nome ILIKE '%Tesouraria%' 
      OR d.nome ILIKE '%Controladoria%'
    )
  )
  OR public.has_role(_user_id, 'admin');
END;
$$;
