-- Fix function search path for security
CREATE OR REPLACE FUNCTION generate_fpq_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'FPQ-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('fpq_code_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_access_payment_queue(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN departamentos d ON p.departamento_id = d.id
    WHERE p.id = _user_id 
    AND (
      d.nome ILIKE '%Financeiro%' 
      OR d.nome ILIKE '%Tesouraria%' 
      OR d.nome ILIKE '%Controladoria%'
      OR p.role = 'admin'
    )
  )
  OR public.has_role(_user_id, 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;