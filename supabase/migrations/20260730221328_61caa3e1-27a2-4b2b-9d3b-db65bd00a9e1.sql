CREATE TABLE IF NOT EXISTS public.china_document_type_labels (
  tipo_key text PRIMARY KEY,
  label_pt text NOT NULL,
  categoria_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.china_document_type_labels TO authenticated;
GRANT ALL ON public.china_document_type_labels TO service_role;

ALTER TABLE public.china_document_type_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "china_document_type_labels_select" ON public.china_document_type_labels;
CREATE POLICY "china_document_type_labels_select"
  ON public.china_document_type_labels FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_china_document_type_labels_touch
  BEFORE UPDATE ON public.china_document_type_labels
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

INSERT INTO public.china_document_type_labels (tipo_key, label_pt, categoria_key) VALUES
  ('volumetria','Volumetria (Líquido e Bruto)','rotulagem'),
  ('formula','Fórmula (Composição)','rotulagem'),
  ('doc_regulatoria','Documentação Regulatória','rotulagem'),
  ('faca_primaria','Faca Primária','embalagem'),
  ('faca_display','Faca Display','embalagem'),
  ('faca_cartucho','Faca Cartucho','embalagem'),
  ('faca_tester','Faca Tester','embalagem'),
  ('amostra_foto','Amostra Embalagem (Fotos)','embalagem'),
  ('amostra_video','Amostra Embalagem (Vídeos)','embalagem'),
  ('planilha_excel','Planilha Excel','dados_oficiais'),
  ('foto_confirmed_item','Produto Confirmado (已确认产品)','fotos_planilha'),
  ('foto_cores_todas','Todas as Cores (颜色照片)','fotos_planilha'),
  ('foto_garrafa','Garrafa/Frasco (瓶子)','fotos_planilha'),
  ('foto_garrafa_design','Design da Garrafa (瓶子设计)','fotos_planilha'),
  ('foto_cores_produto','Cores do Produto (Colors)','fotos_planilha'),
  ('foto_embalagem_ref','Embalagem (Referência)','fotos_planilha'),
  ('foto_produto_individual','Foto Produto Individual','fotos_planilha'),
  ('foto_cores_pesos','Cores (Seção Pesos)','fotos_planilha'),
  ('foto_rotulo','Foto do Rótulo','imagens_gerais'),
  ('foto_arte','Foto da Arte/Layout','imagens_gerais'),
  ('etiqueta_fundo','Etiqueta de Fundo','etiquetas'),
  ('etiqueta_tester','Etiqueta Tester','etiquetas'),
  ('etiqueta_bula','Etiqueta Bula','etiquetas'),
  ('arte_display','Arte Display','artes_brasil'),
  ('ean_unitario','EAN Unitário','codigos_ean'),
  ('ean_display','EAN Display','codigos_ean'),
  ('ean_caixa','EAN Caixa Master','codigos_ean'),
  ('solicitacao_amostra_fotos','Solicitação Amostra (Fotos)','solicitacao_amostras'),
  ('solicitacao_amostra_videos','Solicitação Amostra (Vídeos)','solicitacao_amostras')
ON CONFLICT (tipo_key) DO UPDATE
  SET label_pt = EXCLUDED.label_pt, categoria_key = EXCLUDED.categoria_key;

CREATE OR REPLACE FUNCTION public.china_doc_label(
  p_submissao_id uuid, p_tipo text, p_cofre_item_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(
    (SELECT ci.label_pt FROM public.china_checklist_custom_itens ci
      WHERE ci.submissao_id = p_submissao_id AND ci.tipo_key = p_tipo
        AND nullif(trim(ci.label_pt),'') IS NOT NULL LIMIT 1),
    (SELECT l.label_pt FROM public.china_document_type_labels l WHERE l.tipo_key = p_tipo),
    (SELECT c.nome_pt FROM public.cofre_produto_config c
      WHERE c.id = coalesce(
        p_cofre_item_id,
        CASE WHEN p_tipo ~ '^cofre_[0-9a-fA-F-]{36}$'
             THEN substring(p_tipo from 7)::uuid ELSE NULL END) LIMIT 1),
    nullif(trim(p_tipo),''),
    'Documento'
  )
$$;