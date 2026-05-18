-- 1) Colunas de cenário em fabrica_produtos
ALTER TABLE public.fabrica_produtos
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'oficial',
  ADD COLUMN IF NOT EXISTS grupo_cenario_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cenario_label text NULL,
  ADD COLUMN IF NOT EXISTS promovido_de_grupo_id uuid NULL,
  ADD COLUMN IF NOT EXISTS promovido_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS promovido_por uuid NULL;

-- Validação de domínio via trigger (CHECK precisa ser imutável; trigger é mais flexível)
CREATE OR REPLACE FUNCTION public.fabrica_produtos_validate_modo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.modo NOT IN ('oficial','cenario','arquivado') THEN
    RAISE EXCEPTION 'modo inválido: %', NEW.modo;
  END IF;
  IF NEW.modo IN ('cenario','arquivado') AND NEW.grupo_cenario_id IS NULL THEN
    RAISE EXCEPTION 'cenários e arquivados exigem grupo_cenario_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fabrica_produtos_validate_modo ON public.fabrica_produtos;
CREATE TRIGGER trg_fabrica_produtos_validate_modo
BEFORE INSERT OR UPDATE OF modo, grupo_cenario_id ON public.fabrica_produtos
FOR EACH ROW EXECUTE FUNCTION public.fabrica_produtos_validate_modo();

-- 2) Índice parcial para listagem por grupo de cenário
CREATE INDEX IF NOT EXISTS fabrica_produtos_grupo_cenario_idx
  ON public.fabrica_produtos (grupo_cenario_id)
  WHERE modo <> 'oficial';

CREATE INDEX IF NOT EXISTS fabrica_produtos_modo_idx
  ON public.fabrica_produtos (modo);

-- 3) RPC para promover cenário vencedor
CREATE OR REPLACE FUNCTION public.rpc_promover_cenario(p_produto_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_grupo uuid;
  v_modo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  IF NOT public.check_user_access(v_uid, 'fabrica') THEN
    RAISE EXCEPTION 'sem permissão para promover cenários';
  END IF;

  SELECT grupo_cenario_id, modo
    INTO v_grupo, v_modo
  FROM public.fabrica_produtos
  WHERE id = p_produto_id;

  IF v_grupo IS NULL THEN
    RAISE EXCEPTION 'produto não pertence a um grupo de cenário';
  END IF;

  IF v_modo <> 'cenario' THEN
    RAISE EXCEPTION 'produto não está em modo cenário (atual: %)', v_modo;
  END IF;

  -- Promove o escolhido
  UPDATE public.fabrica_produtos
     SET modo = 'oficial',
         promovido_de_grupo_id = v_grupo,
         promovido_em = now(),
         promovido_por = v_uid,
         grupo_cenario_id = NULL,
         updated_by = v_uid,
         updated_at = now()
   WHERE id = p_produto_id;

  -- Arquiva os demais cenários do mesmo grupo
  UPDATE public.fabrica_produtos
     SET modo = 'arquivado',
         updated_by = v_uid,
         updated_at = now()
   WHERE grupo_cenario_id = v_grupo
     AND id <> p_produto_id
     AND modo = 'cenario';

  RETURN p_produto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_promover_cenario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_promover_cenario(uuid) TO authenticated;

-- 4) RPC para reabrir cenário arquivado (volta a 'cenario' no mesmo grupo)
CREATE OR REPLACE FUNCTION public.rpc_reabrir_cenario(p_produto_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF NOT public.check_user_access(v_uid, 'fabrica') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  UPDATE public.fabrica_produtos
     SET modo = 'cenario',
         updated_by = v_uid,
         updated_at = now()
   WHERE id = p_produto_id
     AND modo = 'arquivado';

  RETURN p_produto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reabrir_cenario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reabrir_cenario(uuid) TO authenticated;