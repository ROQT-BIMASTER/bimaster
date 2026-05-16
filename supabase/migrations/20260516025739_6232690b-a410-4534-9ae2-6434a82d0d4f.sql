-- Resincroniza estados de checklist para todas as fichas China existentes,
-- alinhando com o modelo atual (defaults + customs - ocultos), removendo
-- orfãos e redistribuindo pesos igualmente (preservando status dos itens
-- que continuam existindo). Operação idempotente.

DO $$
DECLARE
  v_submissao_id uuid;
  v_expected_count int;
  v_peso_igual numeric;
  v_residuo numeric;
  v_last_key text;
BEGIN
  -- Tabela temporária com defaults (espelha src/lib/china-document-types.ts)
  CREATE TEMP TABLE _defaults (categoria_key text, item_key text, fluxo text) ON COMMIT DROP;
  INSERT INTO _defaults VALUES
    ('dados_oficiais','planilha_excel','china_envia'),
    ('fotos_planilha','foto_confirmed_item','china_envia'),
    ('fotos_planilha','foto_cores_todas','china_envia'),
    ('fotos_planilha','foto_garrafa','china_envia'),
    ('fotos_planilha','foto_garrafa_design','china_envia'),
    ('fotos_planilha','foto_cores_produto','china_envia'),
    ('fotos_planilha','foto_embalagem_ref','china_envia'),
    ('fotos_planilha','foto_produto_individual','china_envia'),
    ('fotos_planilha','foto_cores_pesos','china_envia'),
    ('imagens_gerais','foto_rotulo','china_envia'),
    ('imagens_gerais','foto_arte','china_envia'),
    ('rotulagem','volumetria','china_envia'),
    ('rotulagem','formula','china_envia'),
    ('rotulagem','doc_regulatoria','china_envia'),
    ('embalagem','faca_primaria','china_envia'),
    ('embalagem','faca_display','china_envia'),
    ('embalagem','faca_cartucho','china_envia'),
    ('embalagem','faca_tester','china_envia'),
    ('embalagem','amostra_foto','china_envia'),
    ('embalagem','amostra_video','china_envia'),
    ('etiquetas','etiqueta_fundo','brasil_envia'),
    ('etiquetas','etiqueta_tester','brasil_envia'),
    ('etiquetas','etiqueta_bula','brasil_envia'),
    ('artes_brasil','arte_display','brasil_envia'),
    ('codigos_ean','ean_unitario','brasil_envia'),
    ('codigos_ean','ean_display','brasil_envia'),
    ('codigos_ean','ean_caixa','brasil_envia'),
    ('solicitacao_amostras','solicitacao_amostra_fotos','brasil_envia'),
    ('solicitacao_amostras','solicitacao_amostra_videos','brasil_envia');

  FOR v_submissao_id IN
    SELECT DISTINCT submissao_id FROM china_checklist_item_estado
    UNION
    SELECT id FROM china_produto_submissoes
  LOOP
    -- Constrói expected para a submissão
    CREATE TEMP TABLE _expected (categoria_key text, item_key text, fluxo text, ord int) ON COMMIT DROP;

    -- defaults (excluindo ocultos)
    INSERT INTO _expected (categoria_key, item_key, fluxo)
    SELECT d.categoria_key, d.item_key, d.fluxo
    FROM _defaults d
    WHERE NOT EXISTS (
      SELECT 1 FROM china_checklist_itens_ocultos h
      WHERE h.submissao_id = v_submissao_id
        AND (h.tipo_key = d.item_key OR h.tipo_key = 'cat:'||d.categoria_key)
    );

    -- itens custom em categoria default
    INSERT INTO _expected (categoria_key, item_key, fluxo)
    SELECT ci.categoria_default_key, ci.tipo_key, d.fluxo
    FROM china_checklist_custom_itens ci
    JOIN _defaults d ON d.categoria_key = ci.categoria_default_key
    WHERE ci.submissao_id = v_submissao_id
      AND ci.categoria_custom_id IS NULL
      AND ci.categoria_default_key IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM china_checklist_itens_ocultos h
        WHERE h.submissao_id = v_submissao_id
          AND (h.tipo_key = ci.tipo_key OR h.tipo_key = 'cat:'||ci.categoria_default_key)
      )
    GROUP BY ci.categoria_default_key, ci.tipo_key, d.fluxo;

    -- categorias custom + seus itens
    INSERT INTO _expected (categoria_key, item_key, fluxo)
    SELECT 'custom_'||cc.id::text, ci.tipo_key, cc.fluxo
    FROM china_checklist_custom_categorias cc
    JOIN china_checklist_custom_itens ci ON ci.categoria_custom_id = cc.id
    WHERE cc.submissao_id = v_submissao_id
      AND ci.submissao_id = v_submissao_id
      AND NOT EXISTS (
        SELECT 1 FROM china_checklist_itens_ocultos h
        WHERE h.submissao_id = v_submissao_id
          AND (h.tipo_key = ci.tipo_key OR h.tipo_key = 'cat:custom_'||cc.id::text)
      );

    -- Atribui ordem estável
    WITH ord AS (
      SELECT ctid, row_number() OVER (ORDER BY fluxo, categoria_key, item_key) AS rn
      FROM _expected
    )
    UPDATE _expected e SET ord = ord.rn FROM ord WHERE e.ctid = ord.ctid;

    SELECT count(*) INTO v_expected_count FROM _expected;

    IF v_expected_count = 0 THEN
      DROP TABLE _expected;
      CONTINUE;
    END IF;

    -- Deleta órfãos
    DELETE FROM china_checklist_item_estado e
    WHERE e.submissao_id = v_submissao_id
      AND NOT EXISTS (
        SELECT 1 FROM _expected x
        WHERE x.fluxo = e.fluxo AND x.categoria_key = e.categoria_key AND x.item_key = e.item_key
      );

    v_peso_igual := floor((100.0 / v_expected_count) * 100) / 100;
    v_residuo := round((100 - v_peso_igual * v_expected_count)::numeric, 2);

    SELECT fluxo||'|'||categoria_key||'|'||item_key
      INTO v_last_key
      FROM _expected ORDER BY ord DESC LIMIT 1;

    -- Atualiza pesos dos sobreviventes
    UPDATE china_checklist_item_estado e
    SET peso_percentual = CASE
      WHEN (e.fluxo||'|'||e.categoria_key||'|'||e.item_key) = v_last_key
        THEN round((v_peso_igual + v_residuo)::numeric, 2)
      ELSE v_peso_igual
    END
    WHERE e.submissao_id = v_submissao_id;

    -- Insere faltantes
    INSERT INTO china_checklist_item_estado
      (submissao_id, fluxo, categoria_key, item_key, peso_percentual, obrigatorio, status)
    SELECT
      v_submissao_id, x.fluxo, x.categoria_key, x.item_key,
      CASE WHEN (x.fluxo||'|'||x.categoria_key||'|'||x.item_key) = v_last_key
        THEN round((v_peso_igual + v_residuo)::numeric, 2)
        ELSE v_peso_igual
      END,
      true, 'pendente'
    FROM _expected x
    WHERE NOT EXISTS (
      SELECT 1 FROM china_checklist_item_estado e
      WHERE e.submissao_id = v_submissao_id
        AND e.fluxo = x.fluxo AND e.categoria_key = x.categoria_key AND e.item_key = x.item_key
    );

    DROP TABLE _expected;
  END LOOP;
END $$;