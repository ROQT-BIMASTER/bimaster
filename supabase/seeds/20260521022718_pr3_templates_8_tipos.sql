-- SEED — NÃO É MIGRATION. Não aplicar automaticamente.
-- Origem: supabase/migrations/20260521022718_pr3_seed_templates_8_tipos.sql (já aplicada em produção).
-- Reaplicação destrói dados. Uso permitido apenas em ambiente novo/clone:
--   psql "$DATABASE_URL" -f supabase/seeds/20260521022718_pr3_templates_8_tipos.sql
-- Histórico no schema_migrations preservado; este arquivo é apenas referência.

-- Migration: adiciona 8 templates mínimos pros 8 tipos canônicos do Briefings v2
--
-- Motivo: após o revert da PR2.5 (20260521002557_..._pr2_revert_pr25_check_8_tipos.sql),
-- a tabela `briefings` exige `tipo IN` dos 8 novos
-- (pdv/embalagem/evento/campanha/ecommerce/presskit/catalogo/material_interno),
-- mas `briefing_templates` ainda só tem registros nos 4 tipos antigos da v1
-- (marketing/criativo/produto/trade). A UI de /dashboard/briefings popula o
-- modal "Novo briefing" a partir de briefing_templates e tenta criar a row em
-- briefings com o tipo do template selecionado — gerando 23514 (CHECK
-- violation) no INSERT em briefings.
--
-- Esta migration:
--   1. Expande o CHECK de briefing_templates pra aceitar 12 tipos (4 antigos
--      + 8 novos), mantendo os 4 antigos intactos por preservação histórica.
--   2. Insere 8 templates mínimos com secoes vazias ('[]'::jsonb) pros tipos
--      novos. Só destrava a UI — campos detalhados (perguntas por tipo da
--      spec 03) entram no Commit 4 do PR3 junto com o novo system prompt.
--
-- O trigger `trg_briefing_templates_updated` em briefing_templates é
-- BEFORE UPDATE FOR EACH ROW EXECUTE update_updated_at_column() — não dispara
-- em INSERT, então não interfere com os seeds desta migration.

BEGIN;

-- ============================================================
-- 1) Expandir CHECK de briefing_templates pra aceitar 12 tipos
-- ============================================================
ALTER TABLE public.briefing_templates
  DROP CONSTRAINT IF EXISTS briefing_templates_tipo_check;
ALTER TABLE public.briefing_templates
  ADD CONSTRAINT briefing_templates_tipo_check
  CHECK (tipo IN (
    -- 4 legados (intactos, preservação histórica)
    'marketing', 'criativo', 'produto', 'trade',
    -- 8 canônicos v2 (novos)
    'pdv', 'embalagem', 'evento', 'campanha',
    'ecommerce', 'presskit', 'catalogo', 'material_interno'
  ));

-- ============================================================
-- 2) Insere 8 templates mínimos pros tipos canônicos
-- ============================================================
-- Coluna `descricao` é nullable text (PR1, linha 12); `secoes` é jsonb com
-- default '[]'. UNIQUE (tipo, versao) é o índice do ON CONFLICT.

INSERT INTO public.briefing_templates (tipo, versao, nome, descricao, secoes, ativo)
VALUES
  ('pdv',              1, 'Briefing PDV',              'Materiais para ponto de venda',          '[]'::jsonb, true),
  ('embalagem',        1, 'Briefing Embalagem',        'Embalagem primária e secundária',        '[]'::jsonb, true),
  ('evento',           1, 'Briefing Evento',           'Materiais para eventos e ativações',     '[]'::jsonb, true),
  ('campanha',         1, 'Briefing Campanha',         'Ações de comunicação 360',               '[]'::jsonb, true),
  ('ecommerce',        1, 'Briefing E-commerce',       'Banners, KV e materiais digitais',       '[]'::jsonb, true),
  ('presskit',         1, 'Briefing Press Kit',        'Materiais para imprensa e influencer',   '[]'::jsonb, true),
  ('catalogo',         1, 'Briefing Catálogo',         'Catálogo de produtos',                   '[]'::jsonb, true),
  ('material_interno', 1, 'Briefing Material Interno', 'Materiais para uso interno',             '[]'::jsonb, true)
ON CONFLICT (tipo, versao) DO NOTHING;

COMMIT;

-- ============================================================
-- ROLLBACK (referência, não executado)
-- ============================================================
-- BEGIN;
--
-- -- 1) Remove os 8 templates mínimos. Filtro extra `secoes = '[]'::jsonb`
-- --    protege contra acidente: se algum desses templates já tiver sido
-- --    populado com campos no Commit 4 do PR3 (ou depois), o DELETE não
-- --    toca neles.
-- DELETE FROM public.briefing_templates
--  WHERE tipo IN ('pdv','embalagem','evento','campanha',
--                 'ecommerce','presskit','catalogo','material_interno')
--    AND versao = 1
--    AND secoes = '[]'::jsonb;
--
-- -- 2) Reverte o CHECK pra apenas os 4 tipos legados.
-- ALTER TABLE public.briefing_templates DROP CONSTRAINT briefing_templates_tipo_check;
-- ALTER TABLE public.briefing_templates
--   ADD CONSTRAINT briefing_templates_tipo_check
--   CHECK (tipo IN ('marketing','criativo','produto','trade'));
--
-- COMMIT;
