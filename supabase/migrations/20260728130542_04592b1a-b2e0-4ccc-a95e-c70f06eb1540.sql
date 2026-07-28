CREATE OR REPLACE FUNCTION public.aplicar_template_checklist(
  p_submissao_id uuid,
  p_template_id uuid,
  p_actor uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estrutura jsonb;
  v_cat jsonb;
  v_item jsonb;
  v_oculto jsonb;
  v_ov jsonb;
  v_cat_map jsonb := '{}'::jsonb;
  v_new_cat_id uuid;
  v_cat_custom_id uuid;
  v_is_custom_cat boolean;
  v_label text;
  v_tipo_key text;
BEGIN
  SELECT estrutura INTO v_estrutura
  FROM public.china_doc_checklist_templates
  WHERE id = p_template_id;

  IF v_estrutura IS NULL THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _tmp_tipos_com_doc (tipo_documento text) ON COMMIT DROP;
  DELETE FROM _tmp_tipos_com_doc;
  INSERT INTO _tmp_tipos_com_doc (tipo_documento)
  SELECT DISTINCT d.tipo_documento
  FROM public.china_produto_documentos d
  WHERE d.submissao_id = p_submissao_id
    AND COALESCE(d.status, '') <> 'planejado';

  DELETE FROM public.china_checklist_custom_itens i
  WHERE i.submissao_id = p_submissao_id
    AND i.tipo_key NOT IN (SELECT tipo_documento FROM _tmp_tipos_com_doc);

  DELETE FROM public.china_checklist_custom_categorias c
  WHERE c.submissao_id = p_submissao_id
    AND NOT EXISTS (
      SELECT 1 FROM public.china_checklist_custom_itens i
      WHERE i.categoria_custom_id = c.id
    );

  DELETE FROM public.china_checklist_itens_ocultos WHERE submissao_id = p_submissao_id;
  DELETE FROM public.china_checklist_cat_overrides WHERE submissao_id = p_submissao_id;

  FOR v_cat IN SELECT * FROM jsonb_array_elements(COALESCE(v_estrutura->'categorias', '[]'::jsonb))
  LOOP
    CONTINUE WHEN NOT COALESCE((v_cat->>'custom')::boolean, false);

    SELECT c.id INTO v_new_cat_id
    FROM public.china_checklist_custom_categorias c
    WHERE c.submissao_id = p_submissao_id
      AND c.fluxo = (v_cat->>'fluxo')
      AND lower(btrim(c.label_pt)) = lower(btrim(v_cat->>'label_pt'))
    LIMIT 1;

    IF v_new_cat_id IS NULL THEN
      INSERT INTO public.china_checklist_custom_categorias
        (submissao_id, label_pt, label_cn, label_en, fluxo, ordem, created_by)
      VALUES (
        p_submissao_id,
        v_cat->>'label_pt',
        v_cat->>'label_cn',
        COALESCE(v_cat->>'label_en', v_cat->>'label_pt'),
        v_cat->>'fluxo',
        COALESCE((v_cat->>'ordem')::int, 0),
        p_actor
      )
      RETURNING id INTO v_new_cat_id;
    END IF;

    v_cat_map := v_cat_map || jsonb_build_object(v_cat->>'key', v_new_cat_id::text);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_estrutura->'itens', '[]'::jsonb))
  LOOP
    CONTINUE WHEN NOT COALESCE((v_item->>'custom')::boolean, false);

    v_label := v_item->>'label_pt';

    SELECT COALESCE((c->>'custom')::boolean, false) INTO v_is_custom_cat
    FROM jsonb_array_elements(COALESCE(v_estrutura->'categorias', '[]'::jsonb)) c
    WHERE c->>'key' = v_item->>'categoria_key'
    LIMIT 1;
    v_is_custom_cat := COALESCE(v_is_custom_cat, false);

    v_cat_custom_id := NULL;
    IF v_is_custom_cat AND v_cat_map ? (v_item->>'categoria_key') THEN
      v_cat_custom_id := (v_cat_map->>(v_item->>'categoria_key'))::uuid;
    END IF;

    IF v_cat_custom_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.china_checklist_custom_itens i
      WHERE i.submissao_id = p_submissao_id
        AND i.categoria_custom_id = v_cat_custom_id
        AND lower(btrim(i.label_pt)) = lower(btrim(v_label))
    ) THEN
      CONTINUE;
    END IF;

    IF v_cat_custom_id IS NULL AND EXISTS (
      SELECT 1 FROM public.china_checklist_custom_itens i
      WHERE i.submissao_id = p_submissao_id
        AND i.categoria_default_key = (v_item->>'categoria_key')
        AND lower(btrim(i.label_pt)) = lower(btrim(v_label))
    ) THEN
      CONTINUE;
    END IF;

    v_tipo_key := 'custom_'
      || (extract(epoch from clock_timestamp()) * 1000)::bigint::text
      || '_' || substr(md5(random()::text || COALESCE(v_label, '')), 1, 5)
      || '_' || left(regexp_replace(lower(COALESCE(v_label, 'item')), '[^a-z0-9]+', '_', 'g'), 24);

    INSERT INTO public.china_checklist_custom_itens
      (submissao_id, categoria_custom_id, categoria_default_key, tipo_key,
       label_pt, label_cn, label_en, accept, multiple, created_by)
    VALUES (
      p_submissao_id,
      v_cat_custom_id,
      CASE WHEN v_is_custom_cat THEN NULL ELSE v_item->>'categoria_key' END,
      v_tipo_key,
      v_label,
      v_item->>'label_cn',
      COALESCE(v_item->>'label_en', v_label),
      COALESCE(v_item->>'accept', 'image/*,.pdf'),
      COALESCE((v_item->>'multiple')::boolean, true),
      p_actor
    );
  END LOOP;

  FOR v_oculto IN SELECT * FROM jsonb_array_elements(COALESCE(v_estrutura->'ocultos', '[]'::jsonb))
  LOOP
    INSERT INTO public.china_checklist_itens_ocultos (submissao_id, tipo_key, hidden_by)
    VALUES (p_submissao_id, trim(both '"' from v_oculto::text), p_actor)
    ON CONFLICT (submissao_id, tipo_key) DO NOTHING;
  END LOOP;

  FOR v_ov IN SELECT * FROM jsonb_array_elements(COALESCE(v_estrutura->'overrides_categoria', '[]'::jsonb))
  LOOP
    INSERT INTO public.china_checklist_cat_overrides
      (submissao_id, categoria_key, label_pt, label_cn, label_en, created_by)
    VALUES (
      p_submissao_id,
      v_ov->>'categoria_key',
      v_ov->>'label_pt',
      v_ov->>'label_cn',
      COALESCE(v_ov->>'label_en', v_ov->>'label_pt'),
      p_actor
    )
    ON CONFLICT (submissao_id, categoria_key) DO UPDATE
      SET label_pt = EXCLUDED.label_pt,
          label_cn = EXCLUDED.label_cn,
          label_en = EXCLUDED.label_en;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_template_checklist(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_template_checklist(uuid, uuid, uuid) TO authenticated, service_role;