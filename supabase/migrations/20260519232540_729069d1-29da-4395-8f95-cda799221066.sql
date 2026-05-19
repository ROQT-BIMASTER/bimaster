
-- 1. Novos campos em fabrica_produtos
ALTER TABLE public.fabrica_produtos
  ADD COLUMN IF NOT EXISTS is_sugestao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sugestao_pai_id uuid NULL REFERENCES public.fabrica_produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vencedor_produto_id uuid NULL REFERENCES public.fabrica_produtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_sugestao_pai
  ON public.fabrica_produtos (sugestao_pai_id)
  WHERE sugestao_pai_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_is_sugestao
  ON public.fabrica_produtos (is_sugestao)
  WHERE is_sugestao = true;

-- 2. Trigger de validação
CREATE OR REPLACE FUNCTION public.fabrica_produtos_validar_sugestao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_sugestao = true AND NEW.tipo = 'DISPLAY' THEN
    RAISE EXCEPTION 'Kits (Display) não podem ser marcados como Sugestão';
  END IF;

  IF NEW.sugestao_pai_id IS NOT NULL AND NEW.sugestao_pai_id = NEW.id THEN
    RAISE EXCEPTION 'Um produto não pode ser concorrente de si mesmo';
  END IF;

  IF NEW.vencedor_produto_id IS NOT NULL AND NEW.vencedor_produto_id = NEW.id THEN
    RAISE EXCEPTION 'Um produto Sugestão não pode ter a si mesmo como vencedor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fabrica_produtos_validar_sugestao ON public.fabrica_produtos;
CREATE TRIGGER trg_fabrica_produtos_validar_sugestao
BEFORE INSERT OR UPDATE OF is_sugestao, sugestao_pai_id, vencedor_produto_id, tipo
ON public.fabrica_produtos
FOR EACH ROW EXECUTE FUNCTION public.fabrica_produtos_validar_sugestao();

-- 3. RPCs (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.rpc_vincular_concorrente_sugestao(
  p_sugestao_id uuid,
  p_concorrente_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_sug boolean;
  v_grupo uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT is_sugestao, grupo_cenario_id INTO v_is_sug, v_grupo
    FROM public.fabrica_produtos WHERE id = p_sugestao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto Sugestão não encontrado';
  END IF;
  IF v_is_sug IS NOT TRUE THEN
    RAISE EXCEPTION 'Produto destino não está marcado como Sugestão';
  END IF;

  IF v_grupo IS NULL THEN
    v_grupo := gen_random_uuid();
    UPDATE public.fabrica_produtos
       SET grupo_cenario_id = v_grupo
     WHERE id = p_sugestao_id;
  END IF;

  UPDATE public.fabrica_produtos
     SET sugestao_pai_id = p_sugestao_id,
         grupo_cenario_id = v_grupo,
         modo = CASE WHEN modo = 'oficial' THEN 'cenario' ELSE modo END,
         cenario_label = COALESCE(cenario_label, 'Concorrente')
   WHERE id = p_concorrente_id
     AND id <> p_sugestao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_desvincular_concorrente_sugestao(
  p_concorrente_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.fabrica_produtos
     SET sugestao_pai_id = NULL,
         modo = CASE WHEN modo = 'arquivado' THEN 'cenario' ELSE modo END
   WHERE id = p_concorrente_id;

  -- Se este concorrente era o vencedor de alguma Sugestão, limpa a referência
  UPDATE public.fabrica_produtos
     SET vencedor_produto_id = NULL
   WHERE vencedor_produto_id = p_concorrente_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_promover_vencedor_sugestao(
  p_sugestao_id uuid,
  p_vencedor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.fabrica_produtos
     WHERE id = p_vencedor_id AND sugestao_pai_id = p_sugestao_id
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Vencedor informado não pertence a esta Sugestão';
  END IF;

  UPDATE public.fabrica_produtos
     SET vencedor_produto_id = p_vencedor_id
   WHERE id = p_sugestao_id;

  UPDATE public.fabrica_produtos
     SET modo = 'cenario'
   WHERE id = p_vencedor_id;

  UPDATE public.fabrica_produtos
     SET modo = 'arquivado'
   WHERE sugestao_pai_id = p_sugestao_id
     AND id <> p_vencedor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reabrir_disputa_sugestao(
  p_sugestao_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.fabrica_produtos
     SET vencedor_produto_id = NULL
   WHERE id = p_sugestao_id;

  UPDATE public.fabrica_produtos
     SET modo = 'cenario'
   WHERE sugestao_pai_id = p_sugestao_id
     AND modo = 'arquivado';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_vincular_concorrente_sugestao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_desvincular_concorrente_sugestao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_promover_vencedor_sugestao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reabrir_disputa_sugestao(uuid) TO authenticated;
