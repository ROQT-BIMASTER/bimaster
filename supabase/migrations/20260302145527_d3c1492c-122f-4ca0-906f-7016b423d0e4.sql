
-- 1. Adicionar coluna updated_by na tabela fabrica_produtos
ALTER TABLE public.fabrica_produtos 
ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 2. Criar tabela de histórico de alterações
CREATE TABLE public.fabrica_produtos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  acao varchar NOT NULL, -- 'INSERT', 'UPDATE'
  campos_alterados jsonb, -- { campo: { antes, depois } }
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index para buscas rápidas
CREATE INDEX idx_fab_prod_hist_produto ON public.fabrica_produtos_historico(produto_id);
CREATE INDEX idx_fab_prod_hist_created ON public.fabrica_produtos_historico(created_at DESC);

-- RLS
ALTER TABLE public.fabrica_produtos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product history"
ON public.fabrica_produtos_historico FOR SELECT
TO authenticated USING (true);

CREATE POLICY "System can insert product history"
ON public.fabrica_produtos_historico FOR INSERT
TO authenticated WITH CHECK (true);

-- 3. Trigger para registrar alterações automaticamente
CREATE OR REPLACE FUNCTION public.fn_fabrica_produtos_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed jsonb := '{}'::jsonb;
  old_json jsonb;
  new_json jsonb;
  key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fabrica_produtos_historico (produto_id, acao, dados_novos, usuario_id)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);

    -- Detectar campos alterados (ignorar updated_at)
    FOR key IN SELECT jsonb_object_keys(new_json)
    LOOP
      IF key NOT IN ('updated_at') AND (old_json ->> key IS DISTINCT FROM new_json ->> key) THEN
        changed := changed || jsonb_build_object(key, jsonb_build_object('antes', old_json -> key, 'depois', new_json -> key));
      END IF;
    END LOOP;

    -- Só registrar se houve mudança real
    IF changed != '{}'::jsonb THEN
      INSERT INTO public.fabrica_produtos_historico (produto_id, acao, campos_alterados, dados_anteriores, dados_novos, usuario_id)
      VALUES (NEW.id, 'UPDATE', changed, old_json, new_json, NEW.updated_by);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_fabrica_produtos_audit
AFTER INSERT OR UPDATE ON public.fabrica_produtos
FOR EACH ROW EXECUTE FUNCTION public.fn_fabrica_produtos_audit();

-- 4. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.fn_fabrica_produtos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fabrica_produtos_updated_at ON public.fabrica_produtos;
CREATE TRIGGER trg_fabrica_produtos_updated_at
BEFORE UPDATE ON public.fabrica_produtos
FOR EACH ROW EXECUTE FUNCTION public.fn_fabrica_produtos_updated_at();
