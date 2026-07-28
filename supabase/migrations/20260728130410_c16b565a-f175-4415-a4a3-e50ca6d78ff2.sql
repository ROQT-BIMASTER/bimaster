-- 1) Coluna de padrão do sistema
ALTER TABLE public.china_doc_checklist_templates
  ADD COLUMN IF NOT EXISTS is_padrao boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS china_doc_checklist_templates_unico_padrao
  ON public.china_doc_checklist_templates ((is_padrao))
  WHERE is_padrao;

-- 2) Função de aplicação da estrutura de um modelo em uma submissão
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
  v_tipo_key text;
BEGIN
  SELECT estrutura INTO v_estrutura
  FROM public.china_doc_checklist_templates
  WHERE id = p_template_id;

  IF v_estrutura IS NULL THEN
    RETURN;
  END IF;

  -- 0) Reset preservando itens que já possuem documento anexado
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

  -- 1) Categorias custom do modelo
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

  -- 2) Itens custom do modelo
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_estrutura->'itens', '[]'::jsonb))
  LOOP
    CONTINUE WHEN NOT COALESCE((v_item->>'custom')::boolean, false);

    SELECT COALESCE((c->>'custom')::boolean, false) INTO v_is_custom_cat
    FROM jsonb_array_elements(COALESCE(v_estrutura->'categorias', '[]'::jsonb)) c
    WHERE c->>'key' = v_item->>'categoria_key'
    LIMIT 1;
    v_is_custom_cat := COALESCE(v_is_custom_cat, false);

    v_cat_custom_id := NULL;
    IF v_is_custom_cat AND v_cat_map ? (v_item->>'categoria_key') THEN
      v_cat_custom_id := (v_cat_map->>(v_item->>'categoria_key'))::uuid;
    END IF;

    -- evita duplicar item com mesmo rótulo na mesma categoria preservada
    IF v_cat_custom_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.china_checklist_custom_itens i
      WHERE i.submissao_id = p_submissao_id
        AND i.categoria_custom_id = v_cat_custom_id
        AND lower(btrim(i.label_pt)) = lower(btrim(v_item->>'label_pt'))
    ) THEN
      CONTINUE;
    END IF;

    IF v_cat_custom_id IS NULL AND EXISTS (
      SELECT 1 FROM public.china_checklist_custom_itens i
      WHERE i.submissao_id = p_submissao_id
        AND i.categoria_default_key = (v_item->>'categoria_key')
        AND lower(btrim(i.label_pt)) = lower(btrim(v_item->>'label_pt'))
    ) THEN
      CONTINUE;
    END IF;

    v_tipo_key := 'custom_'
      || (extract(epoch from clock_timestamp()) * 1000)::bigint::text
      || '_' || substr(md5(random()::text || v_item->>'label_pt'), 1, 5)
      || '_' || left(regexp_replace(lower(v_item->>'label_pt'), '[^a-z0-9]+', '_', 'g'), 24);

    INSERT INTO public.china_checklist_custom_itens
      (submissao_id, categoria_custom_id, categoria_default_key, tipo_key,
       label_pt, label_cn, label_en, accept, multiple, created_by)
    VALUES (
      p_submissao_id,
      v_cat_custom_id,
      CASE WHEN v_is_custom_cat THEN NULL ELSE v_item->>'categoria_key' END,
      v_tipo_key,
      v_item->>'label_pt',
      v_item->>'label_cn',
      COALESCE(v_item->>'label_en', v_item->>'label_pt'),
      COALESCE(v_item->>'accept', 'image/*,.pdf'),
      COALESCE((v_item->>'multiple')::boolean, true),
      p_actor
    );
  END LOOP;

  -- 3) Itens ocultos
  FOR v_oculto IN SELECT * FROM jsonb_array_elements(COALESCE(v_estrutura->'ocultos', '[]'::jsonb))
  LOOP
    INSERT INTO public.china_checklist_itens_ocultos (submissao_id, tipo_key, hidden_by)
    VALUES (p_submissao_id, trim(both '"' from v_oculto::text), p_actor)
    ON CONFLICT (submissao_id, tipo_key) DO NOTHING;
  END LOOP;

  -- 4) Overrides de rótulo de categorias padrão
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

-- 3) Trigger: aplica o modelo padrão a toda nova submissão
CREATE OR REPLACE FUNCTION public.tg_aplicar_template_padrao_submissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM public.china_doc_checklist_templates
  WHERE is_padrao
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    PERFORM public.aplicar_template_checklist(NEW.id, v_template_id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_template_padrao_submissao ON public.china_produto_submissoes;
CREATE TRIGGER trg_aplicar_template_padrao_submissao
AFTER INSERT ON public.china_produto_submissoes
FOR EACH ROW EXECUTE FUNCTION public.tg_aplicar_template_padrao_submissao();

-- 4) RPC para definir o modelo padrão (admin, supervisor ou acesso ao módulo Fábrica China)
CREATE OR REPLACE FUNCTION public.set_template_checklist_padrao(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autorizado boolean;
  v_nome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  v_autorizado :=
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.usuario_permissoes_modulos up
      JOIN public.modulos_sistema m ON m.id = up.modulo_id
      WHERE up.usuario_id = v_uid
        AND m.nome ILIKE '%China%'
    );

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Sem permissão para definir o modelo padrão do checklist';
  END IF;

  SELECT nome INTO v_nome
  FROM public.china_doc_checklist_templates
  WHERE id = p_template_id;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Modelo não encontrado';
  END IF;

  UPDATE public.china_doc_checklist_templates SET is_padrao = false WHERE is_padrao;
  UPDATE public.china_doc_checklist_templates SET is_padrao = true WHERE id = p_template_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (
    v_uid,
    'set_template_checklist_padrao',
    'china_doc_checklist_templates',
    p_template_id::text,
    jsonb_build_object('nome', v_nome, 'is_padrao', true)
  );
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.set_template_checklist_padrao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_template_checklist_padrao(uuid) TO authenticated;

-- 5) Bloqueia exclusão do modelo padrão
CREATE OR REPLACE FUNCTION public.tg_bloquear_delete_template_padrao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_padrao THEN
    RAISE EXCEPTION 'Este modelo é o padrão do sistema. Defina outro modelo como padrão antes de excluí-lo.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_delete_template_padrao ON public.china_doc_checklist_templates;
CREATE TRIGGER trg_bloquear_delete_template_padrao
BEFORE DELETE ON public.china_doc_checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_delete_template_padrao();