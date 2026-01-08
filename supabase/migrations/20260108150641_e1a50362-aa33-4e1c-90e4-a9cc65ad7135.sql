-- Adicionar coluna gerente_id para hierarquia Gerente > Supervisor > Vendedor
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gerente_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_gerente_id ON public.profiles(gerente_id);
CREATE INDEX IF NOT EXISTS idx_profiles_supervisor_id ON public.profiles(supervisor_id);

-- Adicionar role 'gerente' ao enum se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gerente' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'gerente';
  END IF;
END $$;

-- Função para obter subordinados diretos e indiretos (usando text comparison)
CREATE OR REPLACE FUNCTION public.get_subordinates(_user_id uuid)
RETURNS TABLE(subordinate_id uuid, nivel int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    -- Nível 1: subordinados diretos (supervisor_id ou gerente_id)
    SELECT id as subordinate_id, 1 as nivel
    FROM public.profiles
    WHERE supervisor_id = _user_id OR gerente_id = _user_id
    
    UNION ALL
    
    -- Níveis subsequentes
    SELECT p.id, s.nivel + 1
    FROM public.profiles p
    INNER JOIN subordinates s ON p.supervisor_id = s.subordinate_id OR p.gerente_id = s.subordinate_id
    WHERE s.nivel < 5 -- Limitar profundidade
  )
  SELECT DISTINCT subordinate_id, MIN(nivel) as nivel
  FROM subordinates
  GROUP BY subordinate_id
$$;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.gerente_id IS 'ID do gerente responsável (hierarquia: Gerente > Supervisor > Vendedor)';