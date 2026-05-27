
-- 1) Trigger SECURITY DEFINER que protege colunas sensíveis em UPDATE
-- feito pelo próprio usuário. Como roda em SECURITY DEFINER, faz SELECT
-- em profiles SEM passar por RLS — eliminando a recursão.
CREATE OR REPLACE FUNCTION public.profiles_protect_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Admin pode tudo.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Só aplica a proteção quando o usuário está editando o próprio perfil.
  IF v_uid IS NULL OR NEW.id <> v_uid THEN
    RETURN NEW;
  END IF;

  IF NEW.departamento_id IS DISTINCT FROM OLD.departamento_id THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio departamento.' USING ERRCODE = '42501';
  END IF;
  IF NEW.aprovado IS DISTINCT FROM OLD.aprovado THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio status de aprovação.' USING ERRCODE = '42501';
  END IF;
  IF NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio supervisor.' USING ERRCODE = '42501';
  END IF;
  IF NEW.gerente_id IS DISTINCT FROM OLD.gerente_id THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio gerente.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio status.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_self_update_trg ON public.profiles;
CREATE TRIGGER profiles_protect_self_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_protect_self_update();

-- 2) Simplifica a policy profiles_update_own removendo o WITH CHECK recursivo.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));
