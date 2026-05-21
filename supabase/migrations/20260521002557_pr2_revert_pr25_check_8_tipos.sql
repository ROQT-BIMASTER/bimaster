-- Migration: reverter PR2.5 — restaura CHECK das 4 tabelas pros 8 tipos novos
--
-- Motivo: a PR2.5 (20260520234716_..._pr2_5_align_tipo_checks.sql) reduziu o
-- domínio de `tipo` em `briefings`, `briefing_catalogos_padrao`,
-- `briefing_defaults` e `briefing_campos_obrigatorios` de 8 tipos canônicos
-- (pdv/embalagem/evento/campanha/ecommerce/presskit/catalogo/material_interno)
-- para os 4 tipos da taxonomia v1 (marketing/criativo/produto/trade), além de
-- ter feito UPDATE em `briefings` mapeando o registro legado tipo='campanha'
-- para tipo='marketing'.
--
-- A PR2.5 contradiz: README de docs/briefing-especificacoes/ (linha 27 declara
-- 4→8), PR1 (20260520213422_..., que migrou para 8 tipos e preservou
-- tipo_legado em briefings), a função calc_briefing_status (que referencia
-- literais dos 8 tipos), e o documento PR2-seed-proposta.md inteiro. Foi
-- aplicada sem checkpoint humano.
--
-- Esta migration restaura o estado pós-PR1 nas 4 tabelas afetadas. Inclui
-- também uma limpeza inicial (Parte 0) de um briefing de teste criado pós-PR2.5
-- com tipo v1 e sem tipo_legado, que não tem mapping canônico aplicável e
-- travaria o guard.
-- briefing_templates NÃO é tocada (decisão Q1 do review do PR2, opção C):
-- a migração 4→8 dessa tabela fica para o PR3.

BEGIN;

-- ============================================================
-- 0) Limpeza de briefing de teste criado pós-PR2.5
-- ============================================================
-- A linha 0c08612a-1894-47db-a0fc-a56a716e0e66 ('teste 03', tipo='trade',
-- tipo_legado=NULL) foi inserida em 2026-05-20 23:48, depois da PR2.5 ter
-- sido aplicada. É briefing de teste do diagnóstico do agente atual, sem
-- payload ou valor de produção. Removida explicitamente porque não tem
-- mapping canônico (tipo_legado NULL) e travaria o guard da Parte 2.
-- Triplo filtro defensivo (id + tipo + tipo_legado): se a linha tiver mudado
-- de estado entre o diagnóstico e a aplicação, o DELETE não toca nada.
DELETE FROM public.briefings
 WHERE id = '0c08612a-1894-47db-a0fc-a56a716e0e66'
   AND tipo = 'trade'
   AND tipo_legado IS NULL;

-- ============================================================
-- 1) Inverter o UPDATE de dados da PR2.5 em `briefings`
-- ============================================================
-- A PR2.5 fez: UPDATE briefings SET tipo='marketing' WHERE tipo='campanha'.
-- Restauramos exatamente o que ela mudou: rows com tipo='marketing' que têm
-- tipo_legado preenchido (única origem possível dessas linhas é o pipeline
-- PR1→PR2.5, já que o CHECK pós-PR1 não permitia INSERT direto de 'marketing').
-- Linhas com tipo='marketing' SEM tipo_legado, se existirem, ficam por conta
-- do guard abaixo: a migration aborta nelas pra você decidir caso a caso.
UPDATE public.briefings
   SET tipo = 'campanha'
 WHERE tipo = 'marketing'
   AND tipo_legado IS NOT NULL;

-- ============================================================
-- 2) Guards: aborta se sobrar qualquer tipo fora do novo domínio
-- ============================================================
-- Se os guards dispararem, o BEGIN é revertido inteiro (atomic) e nenhum
-- CONSTRAINT é mexido. Diagnóstico fica na própria EXCEPTION.
DO $$
DECLARE
  v_dominio constant text[] := ARRAY[
    'pdv','embalagem','evento','campanha','ecommerce',
    'presskit','catalogo','material_interno'
  ];
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM public.briefings
   WHERE NOT (tipo = ANY (v_dominio));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'briefings ainda tem % linha(s) com tipo fora de %', v_n, v_dominio;
  END IF;

  SELECT count(*) INTO v_n FROM public.briefing_catalogos_padrao
   WHERE NOT (tipo = ANY (v_dominio));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'briefing_catalogos_padrao tem % linha(s) com tipo fora de %', v_n, v_dominio;
  END IF;

  SELECT count(*) INTO v_n FROM public.briefing_defaults
   WHERE NOT (tipo = ANY (v_dominio));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'briefing_defaults tem % linha(s) com tipo fora de %', v_n, v_dominio;
  END IF;

  SELECT count(*) INTO v_n FROM public.briefing_campos_obrigatorios
   WHERE NOT (tipo = ANY (v_dominio));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'briefing_campos_obrigatorios tem % linha(s) com tipo fora de %', v_n, v_dominio;
  END IF;
END$$;

-- ============================================================
-- 3) DROP CONSTRAINT (4 tipos antigos) + ADD CONSTRAINT (8 tipos novos)
-- ============================================================
-- Nomes das constraints confirmados em PR1 (20260520213422_...) e PR2.5
-- (20260520234716_...): briefings_tipo_check,
-- briefing_catalogos_padrao_tipo_check, briefing_defaults_tipo_check,
-- briefing_campos_obrigatorios_tipo_check.

ALTER TABLE public.briefings
  DROP CONSTRAINT IF EXISTS briefings_tipo_check;
ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

ALTER TABLE public.briefing_catalogos_padrao
  DROP CONSTRAINT IF EXISTS briefing_catalogos_padrao_tipo_check;
ALTER TABLE public.briefing_catalogos_padrao
  ADD CONSTRAINT briefing_catalogos_padrao_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

ALTER TABLE public.briefing_defaults
  DROP CONSTRAINT IF EXISTS briefing_defaults_tipo_check;
ALTER TABLE public.briefing_defaults
  ADD CONSTRAINT briefing_defaults_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

ALTER TABLE public.briefing_campos_obrigatorios
  DROP CONSTRAINT IF EXISTS briefing_campos_obrigatorios_tipo_check;
ALTER TABLE public.briefing_campos_obrigatorios
  ADD CONSTRAINT briefing_campos_obrigatorios_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

-- ============================================================
-- briefing_templates: NÃO TOCAR
-- ============================================================
-- Decisão Q1 do review do PR2 (opção C, 2026-05-20): briefing_templates fica
-- com os 4 tipos antigos e seus 4 registros legados intactos (marketing,
-- criativo, produto, trade — versão 1 cada). Migração 4→8 dessa tabela vira
-- escopo do PR3, quando decidirmos entre criar tabela nova ou refatorar.
-- briefings.template_id que aponte pra essas 4 linhas continua válido (FK
-- preservada, sem ON DELETE CASCADE em jogo aqui).

COMMIT;

-- ============================================================
-- ROLLBACK (referência, não executado)
-- ============================================================
-- Para reverter este revert (voltar ao estado da PR2.5):
--
-- BEGIN;
-- ALTER TABLE public.briefings                       DROP CONSTRAINT briefings_tipo_check;
-- ALTER TABLE public.briefings                       ADD CONSTRAINT briefings_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- ALTER TABLE public.briefing_catalogos_padrao       DROP CONSTRAINT briefing_catalogos_padrao_tipo_check;
-- ALTER TABLE public.briefing_catalogos_padrao       ADD CONSTRAINT briefing_catalogos_padrao_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- ALTER TABLE public.briefing_defaults               DROP CONSTRAINT briefing_defaults_tipo_check;
-- ALTER TABLE public.briefing_defaults               ADD CONSTRAINT briefing_defaults_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- ALTER TABLE public.briefing_campos_obrigatorios    DROP CONSTRAINT briefing_campos_obrigatorios_tipo_check;
-- ALTER TABLE public.briefing_campos_obrigatorios    ADD CONSTRAINT briefing_campos_obrigatorios_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- UPDATE public.briefings SET tipo='marketing' WHERE tipo='campanha';
-- COMMIT;
--
-- Para reverter o DELETE da Parte 0:
-- INSERT INTO briefings (id, tipo, tipo_legado, titulo, ...) VALUES (...);
-- NOTA: estado pré-DELETE não recuperável a partir desta migration (sem
-- snapshot dos dados). Se necessário, restaurar de backup do Supabase.
--
-- NÃO RECOMENDADO. Derrubaria o seed do PR2 caso ele já tenha rodado em cima
-- deste revert, e re-introduziria a divergência com README/PR1/specs.
