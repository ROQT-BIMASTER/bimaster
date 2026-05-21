-- Migration PR2: seed Briefings v2 Ruby Rose
-- Aprovado em review: docs/briefing-especificacoes/PR2-seed-proposta.md
-- Postgres 17.6 confirmado (NULLS NOT DISTINCT suportado desde 15).
--
-- Depende de:
--   - PR1 (20260520213422_..._pr1_briefings_v2.sql): tabelas, CHECKs com 8 tipos,
--     rpc_lookup_catalogo v1 (2 níveis).
--   - Revert PR2.5 (20260521002557_pr2_revert_pr25_check_8_tipos.sql): restaura
--     CHECKs nas 4 tabelas para 8 tipos, sem o qual os INSERTs deste seed
--     seriam rejeitados.
--
-- Estrutura desta migration:
--   A)  ALTER COLUMN empresa_id DROP NOT NULL em 3 tabelas (catálogo global tem
--       empresa_id NULL). FK contra empresas(id) é mantida.
--   A+) DROP do unique index PR1 e ADD CONSTRAINT UNIQUE NULLS NOT DISTINCT em 3
--       tabelas. Sem NULLS NOT DISTINCT, o ON CONFLICT em rows com empresa_id
--       NULL não dispara (NULL ≠ NULL no SQL clássico).
--   A++) ADD COLUMN briefing_catalogos_padrao.tipo_uso (canonical|ui_suggestion).
--   B)  CREATE OR REPLACE rpc_lookup_catalogo v2 com fallback de 3 níveis
--       (empresa+marca → empresa+NULL → NULL+NULL).
--   C.1) INSERTs em briefing_catalogos_padrao: 8 catálogos com 64 itens no total.
--   C.3) INSERTs em briefing_defaults: 21 entradas (16 wildcard expandidos +
--        5 PDV específicas).
--   C.4) INSERTs em briefing_campos_obrigatorios: 81 entradas (24 universais +
--        8 linha_colecao + 49 específicas por tipo).
--
-- Templates (briefing_templates) ficam para o PR3 conforme decisão Q1 opção C.

BEGIN;

-- ============================================================
-- A) DROP NOT NULL em empresa_id (catálogo/default/obrigatório global = NULL)
-- ============================================================
ALTER TABLE public.briefing_catalogos_padrao     ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.briefing_defaults             ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.briefing_campos_obrigatorios  ALTER COLUMN empresa_id DROP NOT NULL;

-- ============================================================
-- A+) Unique constraints com NULLS NOT DISTINCT
-- ============================================================
-- briefing_catalogos_padrao: PR1 criou um UNIQUE INDEX usando COALESCE(marca,'')
-- mas não trata NULL em empresa_id. Substituímos por UNIQUE constraint com
-- NULLS NOT DISTINCT, que trata múltiplos NULLs como iguais para fins de
-- unicidade — necessário pro ON CONFLICT do C.1 funcionar.
DROP INDEX IF EXISTS public.briefing_catalogos_padrao_uniq;

ALTER TABLE public.briefing_catalogos_padrao
  ADD CONSTRAINT briefing_catalogos_padrao_empresa_id_marca_tipo_key
  UNIQUE NULLS NOT DISTINCT (empresa_id, marca, tipo);

-- briefing_defaults / briefing_campos_obrigatorios: PR1 criou UNIQUE (...)
-- inline na CREATE TABLE, gerando nomes auto: <tabela>_empresa_id_tipo_campo_key.
ALTER TABLE public.briefing_defaults
  DROP CONSTRAINT briefing_defaults_empresa_id_tipo_campo_key;
ALTER TABLE public.briefing_defaults
  ADD CONSTRAINT briefing_defaults_empresa_id_tipo_campo_key
  UNIQUE NULLS NOT DISTINCT (empresa_id, tipo, campo);

ALTER TABLE public.briefing_campos_obrigatorios
  DROP CONSTRAINT briefing_campos_obrigatorios_empresa_id_tipo_campo_key;
ALTER TABLE public.briefing_campos_obrigatorios
  ADD CONSTRAINT briefing_campos_obrigatorios_empresa_id_tipo_campo_key
  UNIQUE NULLS NOT DISTINCT (empresa_id, tipo, campo);

-- ============================================================
-- A++) ADD COLUMN tipo_uso em briefing_catalogos_padrao
-- ============================================================
ALTER TABLE public.briefing_catalogos_padrao
  ADD COLUMN IF NOT EXISTS tipo_uso text NOT NULL DEFAULT 'canonical'
  CHECK (tipo_uso IN ('canonical', 'ui_suggestion'));

COMMENT ON COLUMN public.briefing_catalogos_padrao.tipo_uso IS
  'canonical = agente sugere itens da lista quando solicitante não sabe; '
  'ui_suggestion = aceita texto livre sem validar contra a lista. '
  'Travado no PR2 review (2026-05).';

-- ============================================================
-- B) rpc_lookup_catalogo v2 — fallback de 3 níveis
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_lookup_catalogo(
  p_empresa_id integer, p_marca text, p_tipo text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_itens jsonb;
BEGIN
  -- Nível 1: override empresa + marca
  SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
   WHERE empresa_id = p_empresa_id AND marca = p_marca AND tipo = p_tipo LIMIT 1;
  IF v_itens IS NOT NULL THEN RETURN v_itens; END IF;

  -- Nível 2: padrão da empresa (marca NULL)
  SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
   WHERE empresa_id = p_empresa_id AND marca IS NULL AND tipo = p_tipo LIMIT 1;
  IF v_itens IS NOT NULL THEN RETURN v_itens; END IF;

  -- Nível 3: global (empresa NULL + marca NULL)
  SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
   WHERE empresa_id IS NULL AND marca IS NULL AND tipo = p_tipo LIMIT 1;
  RETURN COALESCE(v_itens, '[]'::jsonb);
END; $$;

COMMENT ON FUNCTION public.rpc_lookup_catalogo(integer, text, text) IS
  'Lookup hierárquico de catálogo de briefing. Fallback 3 níveis: '
  '(1) empresa+marca, (2) empresa+NULL, (3) NULL+NULL global. '
  'Nível "NULL+marca" intencionalmente omitido — catálogo de marca '
  'cross-empresa não faz parte do modelo atual.';

-- ============================================================
-- C.1) briefing_catalogos_padrao — 8 catálogos globais
-- ============================================================
-- Cada array de `itens` segue: [{"chave","nome"[,"dimensoes_padrao"]}, ...]
-- `dimensoes_padrao` só aparece em pdv (5 itens com valor, 7 com null).
-- inferido_de_pergunta NÃO é persistido (metadata do review).

INSERT INTO public.briefing_catalogos_padrao (empresa_id, marca, tipo, itens, tipo_uso)
VALUES
(NULL, NULL, 'pdv', $$[
  {"chave":"wobbler","nome":"Wobbler","dimensoes_padrao":"15x10cm"},
  {"chave":"stopper","nome":"Stopper","dimensoes_padrao":"20x5cm"},
  {"chave":"faixa_gondola","nome":"Faixa de Gôndola Personalizada","dimensoes_padrao":"90x4cm"},
  {"chave":"regua_gondola","nome":"Régua de Gôndola Personalizada","dimensoes_padrao":null},
  {"chave":"display_balcao","nome":"Display de Balcão","dimensoes_padrao":null},
  {"chave":"display_rolo","nome":"Display de Rolo","dimensoes_padrao":null},
  {"chave":"clip_strip","nome":"Clip Strip","dimensoes_padrao":null},
  {"chave":"cubo_promocional","nome":"Cubo Promocional","dimensoes_padrao":"30x30x30cm"},
  {"chave":"totem","nome":"Totem","dimensoes_padrao":"60x180cm"},
  {"chave":"glorifier","nome":"Glorifier","dimensoes_padrao":null},
  {"chave":"tag","nome":"Tag","dimensoes_padrao":null},
  {"chave":"plotagem_loja","nome":"Plotagem de Loja","dimensoes_padrao":null}
]$$::jsonb, 'canonical'),

(NULL, NULL, 'evento', $$[
  {"chave":"lenco","nome":"Lenço"},
  {"chave":"tote_bag","nome":"Tote Bag"},
  {"chave":"chaveiro","nome":"Chaveiro"},
  {"chave":"cordao_cracha","nome":"Cordão Crachá"},
  {"chave":"card_cracha","nome":"Card Crachá"},
  {"chave":"adesivo","nome":"Adesivo"},
  {"chave":"camiseta_uniforme","nome":"Camiseta / Uniforme"},
  {"chave":"almofada","nome":"Almofada"},
  {"chave":"leque","nome":"Leque"},
  {"chave":"pulseira","nome":"Pulseira"},
  {"chave":"bolsa","nome":"Bolsa"},
  {"chave":"ticket","nome":"Ticket"},
  {"chave":"caixinha_brinde","nome":"Caixinha Brinde"},
  {"chave":"backdrop","nome":"Backdrop / Parede de Fundo"},
  {"chave":"totem","nome":"Totem"},
  {"chave":"arte_ativacao","nome":"Arte de Ativação"}
]$$::jsonb, 'canonical'),

(NULL, NULL, 'embalagem', $$[
  {"chave":"cartucho","nome":"Cartucho"},
  {"chave":"etiqueta_fundo","nome":"Etiqueta de Fundo"},
  {"chave":"etiqueta_bula","nome":"Etiqueta Bula"},
  {"chave":"etiqueta_provador","nome":"Etiqueta Provador / Tester"},
  {"chave":"display","nome":"Display"},
  {"chave":"mockup","nome":"Mockup"},
  {"chave":"cartela","nome":"Cartela"}
]$$::jsonb, 'canonical'),

(NULL, NULL, 'campanha', $$[
  {"chave":"kv_principal","nome":"KV Principal"},
  {"chave":"banner_ecommerce","nome":"Banner E-commerce"},
  {"chave":"post_social","nome":"Post Social"},
  {"chave":"story","nome":"Story"},
  {"chave":"material_pdv","nome":"Material PDV"},
  {"chave":"email_marketing","nome":"Email Marketing"},
  {"chave":"banner_site","nome":"Banner Site"},
  {"chave":"anuncio_revista","nome":"Anúncio Revista / Impressa"}
]$$::jsonb, 'canonical'),

(NULL, NULL, 'ecommerce', $$[
  {"chave":"banner_home","nome":"Banner Home"},
  {"chave":"banner_categoria","nome":"Banner Categoria"},
  {"chave":"banner_promocional","nome":"Banner Promocional"},
  {"chave":"imagem_produto","nome":"Imagem de Produto"},
  {"chave":"listing_marketplace","nome":"Listing Marketplace"},
  {"chave":"email_marketing","nome":"Email Marketing"}
]$$::jsonb, 'canonical'),

(NULL, NULL, 'presskit', $$[
  {"chave":"caixa","nome":"Caixa"},
  {"chave":"rotulo","nome":"Rótulo"},
  {"chave":"card","nome":"Card"},
  {"chave":"brindes","nome":"Brindes"},
  {"chave":"produtos","nome":"Produtos"},
  {"chave":"voucher","nome":"Voucher"}
]$$::jsonb, 'canonical'),

(NULL, NULL, 'catalogo', $$[
  {"chave":"book_trade","nome":"Book Trade"},
  {"chave":"guia_lancamento","nome":"Guia de Lançamento"},
  {"chave":"catalogo_linha","nome":"Catálogo de Linha"},
  {"chave":"apresentacao_comercial","nome":"Apresentação Comercial"}
]$$::jsonb, 'ui_suggestion'),

(NULL, NULL, 'material_interno', $$[
  {"chave":"flyer_poster","nome":"Flyer / Pôster"},
  {"chave":"backdrop","nome":"Backdrop"},
  {"chave":"organograma","nome":"Organograma"},
  {"chave":"decoracao","nome":"Decoração"},
  {"chave":"comunicado","nome":"Comunicado"}
]$$::jsonb, 'ui_suggestion')
ON CONFLICT (empresa_id, marca, tipo) DO NOTHING;

-- ============================================================
-- C.3) briefing_defaults — 21 entradas
-- ============================================================
-- 16 wildcard expandidos (qtde_versoes=3 × 8 tipos, prioridade="Média" × 8) +
-- 5 PDV específicas (dimensoes.* das 5 peças com padrão declarado na spec 03).

INSERT INTO public.briefing_defaults (empresa_id, tipo, campo, valor_padrao)
VALUES
-- qtde_versoes = 3 (wildcard expandido em 8 tipos)
(NULL, 'pdv',              'qtde_versoes', '3'::jsonb),
(NULL, 'embalagem',        'qtde_versoes', '3'::jsonb),
(NULL, 'evento',           'qtde_versoes', '3'::jsonb),
(NULL, 'campanha',         'qtde_versoes', '3'::jsonb),
(NULL, 'ecommerce',        'qtde_versoes', '3'::jsonb),
(NULL, 'presskit',         'qtde_versoes', '3'::jsonb),
(NULL, 'catalogo',         'qtde_versoes', '3'::jsonb),
(NULL, 'material_interno', 'qtde_versoes', '3'::jsonb),

-- prioridade = "Média" (wildcard expandido em 8 tipos)
(NULL, 'pdv',              'prioridade', '"Média"'::jsonb),
(NULL, 'embalagem',        'prioridade', '"Média"'::jsonb),
(NULL, 'evento',           'prioridade', '"Média"'::jsonb),
(NULL, 'campanha',         'prioridade', '"Média"'::jsonb),
(NULL, 'ecommerce',        'prioridade', '"Média"'::jsonb),
(NULL, 'presskit',         'prioridade', '"Média"'::jsonb),
(NULL, 'catalogo',         'prioridade', '"Média"'::jsonb),
(NULL, 'material_interno', 'prioridade', '"Média"'::jsonb),

-- Dimensões padrão PDV (apenas as 5 declaradas na spec 03)
(NULL, 'pdv', 'dimensoes.wobbler',          '"15x10cm"'::jsonb),
(NULL, 'pdv', 'dimensoes.stopper',          '"20x5cm"'::jsonb),
(NULL, 'pdv', 'dimensoes.faixa_gondola',    '"90x4cm"'::jsonb),
(NULL, 'pdv', 'dimensoes.cubo_promocional', '"30x30x30cm"'::jsonb),
(NULL, 'pdv', 'dimensoes.totem',            '"60x180cm"'::jsonb)
ON CONFLICT (empresa_id, tipo, campo) DO NOTHING;

-- ============================================================
-- C.4) briefing_campos_obrigatorios — 81 entradas
-- ============================================================
-- 24 universais (marca, prazo_entrega, titulo × 8 tipos, peso 10) +
-- 8 linha_colecao (peso variável por tipo) +
-- 49 específicas por tipo (pdv 8, emb 7, ev 8, camp 9, ecom 6, pk 3, cat 4, mi 4).
--
-- Coluna `motivo` não existe no schema do PR1 — `motivo` no YAML é
-- documentação do review, não vai pro banco. Omitido. Coluna `ativo` tem
-- DEFAULT true, mantida explícita por legibilidade.

INSERT INTO public.briefing_campos_obrigatorios (empresa_id, tipo, campo, peso, ativo)
VALUES
-- 4.0.a — UNIVERSAIS PESO 10 (24 entradas)
-- marca × 8
(NULL, 'pdv',              'marca', 10, true),
(NULL, 'embalagem',        'marca', 10, true),
(NULL, 'evento',           'marca', 10, true),
(NULL, 'campanha',         'marca', 10, true),
(NULL, 'ecommerce',        'marca', 10, true),
(NULL, 'presskit',         'marca', 10, true),
(NULL, 'catalogo',         'marca', 10, true),
(NULL, 'material_interno', 'marca', 10, true),

-- prazo_entrega × 8
(NULL, 'pdv',              'prazo_entrega', 10, true),
(NULL, 'embalagem',        'prazo_entrega', 10, true),
(NULL, 'evento',           'prazo_entrega', 10, true),
(NULL, 'campanha',         'prazo_entrega', 10, true),
(NULL, 'ecommerce',        'prazo_entrega', 10, true),
(NULL, 'presskit',         'prazo_entrega', 10, true),
(NULL, 'catalogo',         'prazo_entrega', 10, true),
(NULL, 'material_interno', 'prazo_entrega', 10, true),

-- titulo × 8
(NULL, 'pdv',              'titulo', 10, true),
(NULL, 'embalagem',        'titulo', 10, true),
(NULL, 'evento',           'titulo', 10, true),
(NULL, 'campanha',         'titulo', 10, true),
(NULL, 'ecommerce',        'titulo', 10, true),
(NULL, 'presskit',         'titulo', 10, true),
(NULL, 'catalogo',         'titulo', 10, true),
(NULL, 'material_interno', 'titulo', 10, true),

-- 4.0.b — LINHA_COLECAO POR TIPO (8 entradas, pesos variáveis)
(NULL, 'pdv',              'linha_colecao', 10, true),
(NULL, 'embalagem',        'linha_colecao', 10, true),
(NULL, 'evento',           'linha_colecao',  1, true),
(NULL, 'campanha',         'linha_colecao', 10, true),
(NULL, 'ecommerce',        'linha_colecao',  1, true),
(NULL, 'presskit',         'linha_colecao', 10, true),
(NULL, 'catalogo',         'linha_colecao',  1, true),
(NULL, 'material_interno', 'linha_colecao',  1, true),

-- 4.1 — PDV (8 entradas)
(NULL, 'pdv', 'material_type',     10, true),
(NULL, 'pdv', 'dimensoes',         10, true),
(NULL, 'pdv', 'qtde_versoes',      10, true),
(NULL, 'pdv', 'kv_referencia',     10, true),
(NULL, 'pdv', 'faca_gabarito',      1, true),
(NULL, 'pdv', 'copy_texto',         1, true),
(NULL, 'pdv', 'cliente_rede',       1, true),
(NULL, 'pdv', 'produtos_destaque',  1, true),

-- 4.2 — EMBALAGEM (7 entradas)
(NULL, 'embalagem', 'componente',         10, true),
(NULL, 'embalagem', 'produto_sku',        10, true),
(NULL, 'embalagem', 'tipo_alteracao',     10, true),
(NULL, 'embalagem', 'faca',               10, true),
(NULL, 'embalagem', 'dados_regulatorios',  1, true),
(NULL, 'embalagem', 'variantes_cor',       1, true),
(NULL, 'embalagem', 'arte_anterior',       1, true),

-- 4.3 — EVENTO (8 entradas — kv_referencia rebaixado para peso 1 no review)
(NULL, 'evento', 'evento_nome',    10, true),
(NULL, 'evento', 'evento_data',    10, true),
(NULL, 'evento', 'brinde_type',    10, true),
(NULL, 'evento', 'kv_referencia',   1, true),
(NULL, 'evento', 'dimensoes',       1, true),
(NULL, 'evento', 'quantidade',      1, true),
(NULL, 'evento', 'conceito_tema',   1, true),
(NULL, 'evento', 'specs_producao',  1, true),

-- 4.4 — CAMPANHA (9 entradas)
(NULL, 'campanha', 'nome_campanha',      10, true),
(NULL, 'campanha', 'desdobramento_tipo', 10, true),
(NULL, 'campanha', 'canal',              10, true),
(NULL, 'campanha', 'formato_entrega',    10, true),
(NULL, 'campanha', 'kv_referencia',      10, true),
(NULL, 'campanha', 'dimensoes',           1, true),
(NULL, 'campanha', 'copy_aprovado',       1, true),
(NULL, 'campanha', 'produtos_destaque',   1, true),
(NULL, 'campanha', 'moodboard',           1, true),

-- 4.5 — E-COMMERCE (6 entradas)
(NULL, 'ecommerce', 'plataforma',     10, true),
(NULL, 'ecommerce', 'tipo_material',  10, true),
(NULL, 'ecommerce', 'dimensoes',      10, true),
(NULL, 'ecommerce', 'promocao_info',   1, true),
(NULL, 'ecommerce', 'copy',            1, true),
(NULL, 'ecommerce', 'fotos_produtos',  1, true),

-- 4.6 — PRESS KIT (3 entradas)
(NULL, 'presskit', 'publico',     10, true),
(NULL, 'presskit', 'componentes', 10, true),
(NULL, 'presskit', 'quantidade',  10, true),

-- 4.7 — CATÁLOGO / BOOK (4 entradas)
(NULL, 'catalogo', 'tipo_catalogo',   10, true),
(NULL, 'catalogo', 'conteudo_secoes', 10, true),
(NULL, 'catalogo', 'formato',         10, true),
(NULL, 'catalogo', 'idioma',          10, true),

-- 4.8 — MATERIAL INTERNO (4 entradas)
(NULL, 'material_interno', 'tipo_material',    10, true),
(NULL, 'material_interno', 'dimensao',         10, true),
(NULL, 'material_interno', 'copy',             10, true),
(NULL, 'material_interno', 'formato_entrega',  10, true)
ON CONFLICT (empresa_id, tipo, campo) DO NOTHING;

COMMIT;

-- ============================================================
-- ROLLBACK (referência, não executado)
-- ============================================================
-- BEGIN;
--
-- -- 1) Apaga seeds (todos com empresa_id IS NULL)
-- DELETE FROM public.briefing_campos_obrigatorios WHERE empresa_id IS NULL;
-- DELETE FROM public.briefing_defaults            WHERE empresa_id IS NULL;
-- DELETE FROM public.briefing_catalogos_padrao    WHERE empresa_id IS NULL;
--
-- -- 2) Volta rpc_lookup_catalogo pra v1 (2 níveis, sem fallback global)
-- CREATE OR REPLACE FUNCTION public.rpc_lookup_catalogo(p_empresa_id integer, p_marca text, p_tipo text)
-- RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
-- DECLARE v_itens jsonb;
-- BEGIN
--   SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
--    WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND marca = p_marca LIMIT 1;
--   IF v_itens IS NOT NULL THEN RETURN v_itens; END IF;
--   SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
--    WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND marca IS NULL LIMIT 1;
--   RETURN COALESCE(v_itens, '[]'::jsonb);
-- END; $$;
--
-- -- 3) Reverte unique constraints pra NULLS DISTINCT (padrão SQL)
-- ALTER TABLE public.briefing_campos_obrigatorios DROP CONSTRAINT briefing_campos_obrigatorios_empresa_id_tipo_campo_key;
-- ALTER TABLE public.briefing_campos_obrigatorios ADD  CONSTRAINT briefing_campos_obrigatorios_empresa_id_tipo_campo_key UNIQUE (empresa_id, tipo, campo);
-- ALTER TABLE public.briefing_defaults             DROP CONSTRAINT briefing_defaults_empresa_id_tipo_campo_key;
-- ALTER TABLE public.briefing_defaults             ADD  CONSTRAINT briefing_defaults_empresa_id_tipo_campo_key UNIQUE (empresa_id, tipo, campo);
-- ALTER TABLE public.briefing_catalogos_padrao     DROP CONSTRAINT briefing_catalogos_padrao_empresa_id_marca_tipo_key;
-- CREATE UNIQUE INDEX briefing_catalogos_padrao_uniq ON public.briefing_catalogos_padrao(empresa_id, COALESCE(marca,''), tipo);
--
-- -- 4) Reverte tipo_uso e NOT NULL em empresa_id (seguro porque os únicos NULLs vieram do seed apagado)
-- ALTER TABLE public.briefing_catalogos_padrao DROP COLUMN tipo_uso;
-- ALTER TABLE public.briefing_catalogos_padrao     ALTER COLUMN empresa_id SET NOT NULL;
-- ALTER TABLE public.briefing_defaults             ALTER COLUMN empresa_id SET NOT NULL;
-- ALTER TABLE public.briefing_campos_obrigatorios  ALTER COLUMN empresa_id SET NOT NULL;
--
-- COMMIT;
