BEGIN;

-- PR2.5 — Alinha CHECK de `tipo` em 4 tabelas com a nova taxonomia
-- (marketing | criativo | produto | trade), idêntica ao CHECK já vigente
-- em `briefing_templates` desde o PR1.
--
-- Ordem importa: o UPDATE de 'campanha' -> 'marketing' precisa rodar com o
-- CHECK antigo já removido (CHECK é reavaliado a cada UPDATE), e o ADD do
-- novo CHECK só é válido depois que todas as linhas estiverem no novo domínio.

-- 1) DROP dos CHECKs antigos nas 4 tabelas
ALTER TABLE public.briefings
  DROP CONSTRAINT briefings_tipo_check;
ALTER TABLE public.briefing_catalogos_padrao
  DROP CONSTRAINT briefing_catalogos_padrao_tipo_check;
ALTER TABLE public.briefing_defaults
  DROP CONSTRAINT briefing_defaults_tipo_check;
ALTER TABLE public.briefing_campos_obrigatorios
  DROP CONSTRAINT briefing_campos_obrigatorios_tipo_check;

-- 2) Migra o único registro legado em `briefings`
--    Mapping: 'campanha' -> 'marketing' (Marketing = "Campanhas, KPIs" na UI)
UPDATE public.briefings
   SET tipo = 'marketing'
 WHERE tipo = 'campanha';

-- 3) Trava: aborta se ainda houver qualquer linha fora do novo domínio
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.briefings
   WHERE tipo NOT IN ('marketing','criativo','produto','trade');
  IF n > 0 THEN
    RAISE EXCEPTION 'briefings ainda tem % linha(s) fora do novo dominio de tipo', n;
  END IF;
END$$;

-- 4) ADD dos CHECKs novos nas 4 tabelas, todos com a mesma lista
ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_tipo_check
    CHECK (tipo = ANY (ARRAY['marketing','criativo','produto','trade']));

ALTER TABLE public.briefing_catalogos_padrao
  ADD CONSTRAINT briefing_catalogos_padrao_tipo_check
    CHECK (tipo = ANY (ARRAY['marketing','criativo','produto','trade']));

ALTER TABLE public.briefing_defaults
  ADD CONSTRAINT briefing_defaults_tipo_check
    CHECK (tipo = ANY (ARRAY['marketing','criativo','produto','trade']));

ALTER TABLE public.briefing_campos_obrigatorios
  ADD CONSTRAINT briefing_campos_obrigatorios_tipo_check
    CHECK (tipo = ANY (ARRAY['marketing','criativo','produto','trade']));

COMMIT;

-- ROLLBACK (manual, comentado):
-- BEGIN;
--   ALTER TABLE public.briefings                    DROP CONSTRAINT briefings_tipo_check;
--   ALTER TABLE public.briefing_catalogos_padrao    DROP CONSTRAINT briefing_catalogos_padrao_tipo_check;
--   ALTER TABLE public.briefing_defaults            DROP CONSTRAINT briefing_defaults_tipo_check;
--   ALTER TABLE public.briefing_campos_obrigatorios DROP CONSTRAINT briefing_campos_obrigatorios_tipo_check;
--   UPDATE public.briefings SET tipo='campanha' WHERE tipo='marketing'; -- reverte TODOS os 'marketing'
--   ALTER TABLE public.briefings                    ADD CONSTRAINT briefings_tipo_check
--     CHECK (tipo = ANY (ARRAY['pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno']));
--   ALTER TABLE public.briefing_catalogos_padrao    ADD CONSTRAINT briefing_catalogos_padrao_tipo_check
--     CHECK (tipo = ANY (ARRAY['pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno']));
--   ALTER TABLE public.briefing_defaults            ADD CONSTRAINT briefing_defaults_tipo_check
--     CHECK (tipo = ANY (ARRAY['pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno']));
--   ALTER TABLE public.briefing_campos_obrigatorios ADD CONSTRAINT briefing_campos_obrigatorios_tipo_check
--     CHECK (tipo = ANY (ARRAY['pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno']));
-- COMMIT;