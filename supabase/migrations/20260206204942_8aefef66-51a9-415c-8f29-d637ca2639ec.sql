-- ========================================
-- 1. Colunas de coordenadas em clientes e prospects
-- ========================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Índices para queries geográficas
CREATE INDEX IF NOT EXISTS idx_clientes_coords 
  ON public.clientes(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_coords 
  ON public.prospects(latitude, longitude) WHERE latitude IS NOT NULL;

-- ========================================
-- 2. Trigger de normalização automática para carga incremental
-- ========================================
CREATE OR REPLACE FUNCTION public.fn_normalizar_cliente_individual()
RETURNS trigger AS $$
DECLARE
  v_ibge_id integer;
  v_ibge_nome text;
BEGIN
  -- Só executa se cidade ou uf mudaram (ou é INSERT)
  IF TG_OP = 'INSERT' 
     OR OLD.cidade IS DISTINCT FROM NEW.cidade 
     OR OLD.uf IS DISTINCT FROM NEW.uf THEN
    
    -- Limpa campos se cidade/uf vazios
    IF NEW.cidade IS NULL OR TRIM(NEW.cidade) = '' 
       OR NEW.uf IS NULL OR TRIM(NEW.uf) = '' THEN
      NEW.ibge_municipio_id := NULL;
      NEW.cidade_normalizada := NULL;
      RETURN NEW;
    END IF;

    -- Match direto via unaccent
    SELECT m.id, m.nome INTO v_ibge_id, v_ibge_nome
    FROM public.ibge_municipios m
    JOIN public.ibge_estados e ON m.uf_id = e.id
    WHERE e.sigla = UPPER(TRIM(NEW.uf))
      AND UPPER(public.unaccent(TRIM(m.nome))) 
        = UPPER(public.unaccent(TRIM(NEW.cidade)))
    LIMIT 1;

    -- Fallback: sem caracteres especiais (apóstrofos, hifens, etc.)
    IF v_ibge_id IS NULL THEN
      SELECT m.id, m.nome INTO v_ibge_id, v_ibge_nome
      FROM public.ibge_municipios m
      JOIN public.ibge_estados e ON m.uf_id = e.id
      WHERE e.sigla = UPPER(TRIM(NEW.uf))
        AND UPPER(regexp_replace(
              public.unaccent(TRIM(m.nome)), 
              '[''´`\-\s]', '', 'g'))
          = UPPER(regexp_replace(
              public.unaccent(TRIM(NEW.cidade)), 
              '[''´`\-\s]', '', 'g'))
      LIMIT 1;
    END IF;

    -- Caso especial DF: todas as regiões administrativas mapeiam para Brasília
    IF v_ibge_id IS NULL AND UPPER(TRIM(NEW.uf)) = 'DF' THEN
      SELECT m.id, m.nome INTO v_ibge_id, v_ibge_nome
      FROM public.ibge_municipios m
      JOIN public.ibge_estados e ON m.uf_id = e.id
      WHERE e.sigla = 'DF' 
      AND UPPER(m.nome) = 'BRASÍLIA'
      LIMIT 1;
    END IF;

    NEW.ibge_municipio_id := v_ibge_id;
    NEW.cidade_normalizada := v_ibge_nome;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop trigger se já existir para recriar
DROP TRIGGER IF EXISTS tr_normalizar_municipio_cliente ON public.clientes;

-- Criar trigger BEFORE INSERT OR UPDATE
CREATE TRIGGER tr_normalizar_municipio_cliente
  BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalizar_cliente_individual();