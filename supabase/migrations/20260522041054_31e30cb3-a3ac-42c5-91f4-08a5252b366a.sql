-- 1) Flag de fornecedor pendente de complemento (CNPJ vazio)
ALTER TABLE public.fabrica_fornecedores
  ADD COLUMN IF NOT EXISTS pendente_complemento boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fornecedores_pendente
  ON public.fabrica_fornecedores (pendente_complemento)
  WHERE pendente_complemento = true;

-- 2) Sequence para códigos MP
CREATE SEQUENCE IF NOT EXISTS public.fabrica_mp_codigo_seq START 1;

-- Inicializa em max(numero) atual de códigos MP-NNNNN, se existirem
DO $$
DECLARE
  max_n int;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(codigo, '^MP-', ''))::int), 0)
    INTO max_n
  FROM public.fabrica_materias_primas
  WHERE codigo ~ '^MP-[0-9]+$';
  IF max_n > 0 THEN
    PERFORM setval('public.fabrica_mp_codigo_seq', max_n);
  END IF;
END $$;

-- 3) Função next_mp_codigo()
CREATE OR REPLACE FUNCTION public.next_mp_codigo()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'MP-' || lpad(nextval('public.fabrica_mp_codigo_seq')::text, 5, '0');
$$;