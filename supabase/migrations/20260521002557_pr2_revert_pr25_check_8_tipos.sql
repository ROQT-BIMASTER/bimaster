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
-- também uma limpeza (Parte 2) de um briefing de teste criado pós-PR2.5 com
-- tipo v1 e sem tipo_legado, que não tem mapping canônico aplicável e
-- travaria o guard.
--
-- ORDEM TÉCNICA DAS PARTES:
--   1) DROP dos CHECKs antigos
--   2) DELETE do briefing de teste pós-PR2.5
--   3) UPDATE invertendo o mapping da PR2.5 em `briefings`
--   4) Guards de validação de domínio
--   5) ADD dos CHECKs novos com os 8 tipos
--
-- Razão da ordem: CHECK constraints em Postgres são validados row-by-row em
-- INSERT e em UPDATE (não apenas no ADD CONSTRAINT). Enquanto o CHECK antigo
-- (4 tipos v1) estiver ativo, ele rejeita qualquer UPDATE que tente mover
-- linhas para fora do domínio v1 — inclusive os UPDATEs deste próprio script
-- de transição. Por isso o DROP precisa vir antes do UPDATE/DELETE. A
-- atomicidade é preservada pelo BEGIN/COMMIT: qualquer falha (incluindo o
-- guard da Parte 4) rolla a transação inteira, reinstalando os CHECKs
-- antigos automaticamente.
--
-- briefing_templates NÃO é tocada (decisão Q1 do review do PR2, opção C):
-- a migração 4→8 dessa tabela fica para o PR3.

BEGIN;

-- ============================================================
-- 1) DROP dos CHECKs antigos (PR2.5) — ANTES de qualquer UPDATE/DELETE
-- ============================================================
-- Libera o domínio em todas as 4 tabelas para que os passos seguintes
-- consigam mover linhas pro domínio v2 sem rejeição do CHECK ativo.
-- briefing_templates NÃO entra aqui (decisão Q1 opção C — fica pro PR3).
ALTER TABLE public.briefings
  DROP CONSTRAINT IF EXISTS briefings_tipo_check;
ALTER TABLE public.briefing_catalogos_padrao
  DROP CONSTRAINT IF EXISTS briefing_catalogos_padrao_tipo_check;
ALTER TABLE public.briefing_defaults
  DROP CONSTRAINT IF EXISTS briefing_defaults_tipo_check;
ALTER TABLE public.briefing_campos_obrigatorios
  DROP CONSTRAINT IF EXISTS briefing_campos_obrigatorios_tipo_check;

-- ============================================================
-- 2) Limpeza de briefing de teste criado pós-PR2.5
-- ============================================================
-- A linha 0c08612a-1894-47db-a0fc-a56a716e0e66 ('teste 03', tipo='trade',
-- tipo_legado=NULL) foi inserida em 2026-05-20 23:48, depois da PR2.5 ter
-- sido aplicada. É briefing de teste do diagnóstico do agente atual, sem
-- payload ou valor de produção. Removida explicitamente porque não tem
-- mapping canônico (tipo_legado NULL) e travaria o guard da Parte 4.
-- Triplo filtro defensivo (id + tipo + tipo_legado): se a linha tiver mudado
-- de estado entre o diagnóstico e a aplicação, o DELETE não toca nada.
DELETE FROM public.briefings
 WHERE id = '0c08612a-1894-47db-a0fc-a56a716e0e66'
   AND tipo = 'trade'
   AND tipo_legado IS NULL;

-- ============================================================
-- 3) Inverter o UPDATE de dados da PR2.5 em `briefings`
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
-- 4) Guards: aborta se sobrar qualquer tipo fora do novo domínio
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
-- 5) ADD dos CHECKs novos (8 tipos canônicos)
-- ============================================================
-- Nomes das constraints confirmados em PR1 (20260520213422_...) e PR2.5
-- (20260520234716_...): briefings_tipo_check,
-- briefing_catalogos_padrao_tipo_check, briefing_defaults_tipo_check,
-- briefing_campos_obrigatorios_tipo_check. Sem DROP aqui — já foi feito
-- na Parte 1.

ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

ALTER TABLE public.briefing_catalogos_padrao
  ADD CONSTRAINT briefing_catalogos_padrao_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

ALTER TABLE public.briefing_defaults
  ADD CONSTRAINT briefing_defaults_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

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
-- Para reverter este revert (voltar ao estado da PR2.5), espelha a mesma
-- ordem: DROP novos → INSERT do teste 03 (não recuperável) → UPDATE inverso
-- → ADD antigos. O DROP precisa vir antes do UPDATE invertido pelo mesmo
-- motivo de validate-on-write descrito no cabeçalho.
--
-- BEGIN;
--
-- -- 1) DROP dos CHECKs novos (8 tipos)
-- ALTER TABLE public.briefings                       DROP CONSTRAINT briefings_tipo_check;
-- ALTER TABLE public.briefing_catalogos_padrao       DROP CONSTRAINT briefing_catalogos_padrao_tipo_check;
-- ALTER TABLE public.briefing_defaults               DROP CONSTRAINT briefing_defaults_tipo_check;
-- ALTER TABLE public.briefing_campos_obrigatorios    DROP CONSTRAINT briefing_campos_obrigatorios_tipo_check;
--
-- -- 2) Recriar a linha de teste 'teste 03' (NÃO RECUPERÁVEL automaticamente
-- --    a partir desta migration — sem snapshot dos dados deletados).
-- --    Se necessário, restaurar via backup do Supabase ou recriar manualmente
-- --    com INSERT explícito.
-- -- INSERT INTO public.briefings (id, user_id, tipo, titulo, ...) VALUES
-- --   ('0c08612a-1894-47db-a0fc-a56a716e0e66', ..., 'trade', 'teste 03', ...);
--
-- -- 3) UPDATE inverso: campanha → marketing (espelha o que a PR2.5 fez)
-- UPDATE public.briefings SET tipo='marketing' WHERE tipo='campanha';
--
-- -- 4) ADD dos CHECKs antigos (4 tipos v1)
-- ALTER TABLE public.briefings                       ADD CONSTRAINT briefings_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- ALTER TABLE public.briefing_catalogos_padrao       ADD CONSTRAINT briefing_catalogos_padrao_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- ALTER TABLE public.briefing_defaults               ADD CONSTRAINT briefing_defaults_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
-- ALTER TABLE public.briefing_campos_obrigatorios    ADD CONSTRAINT briefing_campos_obrigatorios_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
--
-- COMMIT;
--
-- NÃO RECOMENDADO. Derrubaria o seed do PR2 caso ele já tenha rodado em cima
-- deste revert, e re-introduziria a divergência com README/PR1/specs.
