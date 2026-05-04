
-- =====================================================================
-- 1) FLUXO POR PROJETO + OFICIALIZAÇÃO + SLA
-- =====================================================================

ALTER TABLE public.fluxo_aprovacao_config
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_origem_id uuid REFERENCES public.fluxo_aprovacao_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS editavel_por_coordenador boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS oficializacao_modo text NOT NULL DEFAULT 'desativado',
  ADD COLUMN IF NOT EXISTS oficializacao_destino text NOT NULL DEFAULT 'produto';

ALTER TABLE public.fluxo_aprovacao_config
  DROP CONSTRAINT IF EXISTS fac_oficializacao_modo_chk;
ALTER TABLE public.fluxo_aprovacao_config
  ADD CONSTRAINT fac_oficializacao_modo_chk
  CHECK (oficializacao_modo IN ('auto','manual','desativado'));

ALTER TABLE public.fluxo_aprovacao_config
  DROP CONSTRAINT IF EXISTS fac_oficializacao_destino_chk;
ALTER TABLE public.fluxo_aprovacao_config
  ADD CONSTRAINT fac_oficializacao_destino_chk
  CHECK (oficializacao_destino IN ('produto','generico','escolher'));

CREATE INDEX IF NOT EXISTS idx_fac_projeto ON public.fluxo_aprovacao_config(projeto_id);

-- Política: coordenadores/owners/líderes do projeto gerenciam fluxos do próprio projeto
DROP POLICY IF EXISTS "Coord can manage project flows" ON public.fluxo_aprovacao_config;
CREATE POLICY "Coord can manage project flows"
  ON public.fluxo_aprovacao_config FOR ALL TO authenticated
  USING (
    projeto_id IS NOT NULL
    AND projeto_id IN (
      SELECT pm.projeto_id FROM public.projeto_membros pm
       WHERE pm.user_id = auth.uid()
         AND pm.papel IN ('coordenador','owner','lider')
    )
  )
  WITH CHECK (
    projeto_id IS NOT NULL
    AND projeto_id IN (
      SELECT pm.projeto_id FROM public.projeto_membros pm
       WHERE pm.user_id = auth.uid()
         AND pm.papel IN ('coordenador','owner','lider')
    )
  );

-- Etapas: SLA por etapa
ALTER TABLE public.fluxo_aprovacao_etapas
  ADD COLUMN IF NOT EXISTS sla_horas integer,
  ADD COLUMN IF NOT EXISTS sla_horas_uteis boolean NOT NULL DEFAULT true;

-- Política para etapas seguir o pai
DROP POLICY IF EXISTS "Coord can manage project flow stages" ON public.fluxo_aprovacao_etapas;
CREATE POLICY "Coord can manage project flow stages"
  ON public.fluxo_aprovacao_etapas FOR ALL TO authenticated
  USING (
    config_id IN (
      SELECT c.id FROM public.fluxo_aprovacao_config c
       WHERE c.projeto_id IS NOT NULL
         AND c.projeto_id IN (
           SELECT pm.projeto_id FROM public.projeto_membros pm
            WHERE pm.user_id = auth.uid()
              AND pm.papel IN ('coordenador','owner','lider')
         )
    )
  )
  WITH CHECK (
    config_id IN (
      SELECT c.id FROM public.fluxo_aprovacao_config c
       WHERE c.projeto_id IS NOT NULL
         AND c.projeto_id IN (
           SELECT pm.projeto_id FROM public.projeto_membros pm
            WHERE pm.user_id = auth.uid()
              AND pm.papel IN ('coordenador','owner','lider')
         )
    )
  );

-- =====================================================================
-- 2) DELEGAÇÃO
-- =====================================================================

ALTER TABLE public.aprovacao_documento_itens
  ADD COLUMN IF NOT EXISTS delegado_de uuid,
  ADD COLUMN IF NOT EXISTS delegado_em timestamptz,
  ADD COLUMN IF NOT EXISTS oficializado_em timestamptz,
  ADD COLUMN IF NOT EXISTS oficializado_destino text;

CREATE INDEX IF NOT EXISTS idx_adi_delegado_de ON public.aprovacao_documento_itens(delegado_de) WHERE delegado_de IS NOT NULL;

-- =====================================================================
-- 3) COFRE GENÉRICO
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cofre_generico_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cofre_generico_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cgc_select ON public.cofre_generico_categorias;
CREATE POLICY cgc_select ON public.cofre_generico_categorias
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cgc_admin ON public.cofre_generico_categorias;
CREATE POLICY cgc_admin ON public.cofre_generico_categorias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.cofre_generico_categorias(nome, descricao)
VALUES
  ('Contratos','Contratos institucionais e comerciais'),
  ('Políticas','Políticas internas oficiais'),
  ('Manuais','Manuais e procedimentos'),
  ('Certidões','Certidões e atestados oficiais')
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cofre_generico_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES public.cofre_generico_categorias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  arquivo_path text NOT NULL,
  arquivo_url text,
  mime_type text,
  tamanho integer,
  origem_aprovacao_item_id uuid REFERENCES public.aprovacao_documento_itens(id) ON DELETE SET NULL,
  oficializado_por uuid,
  oficializado_em timestamptz NOT NULL DEFAULT now(),
  revogado boolean NOT NULL DEFAULT false,
  revogado_em timestamptz,
  revogado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cgd_categoria ON public.cofre_generico_documentos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_cgd_origem ON public.cofre_generico_documentos(origem_aprovacao_item_id);

ALTER TABLE public.cofre_generico_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cgd_select ON public.cofre_generico_documentos;
CREATE POLICY cgd_select ON public.cofre_generico_documentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cgd_admin ON public.cofre_generico_documentos;
CREATE POLICY cgd_admin ON public.cofre_generico_documentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Bucket privado para arquivos do cofre genérico
INSERT INTO storage.buckets (id, name, public)
VALUES ('cofre-generico','cofre-generico', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cofre_generico_select" ON storage.objects;
CREATE POLICY "cofre_generico_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cofre-generico');

DROP POLICY IF EXISTS "cofre_generico_admin_write" ON storage.objects;
CREATE POLICY "cofre_generico_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cofre-generico' AND public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 4) RPCs
-- =====================================================================

-- Clonar template para projeto
CREATE OR REPLACE FUNCTION public.rpc_clonar_fluxo_para_projeto(
  p_template_id uuid,
  p_projeto_id uuid,
  p_nome text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_novo_id uuid;
  v_template public.fluxo_aprovacao_config%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projeto_membros pm
     WHERE pm.projeto_id = p_projeto_id AND pm.user_id = v_uid
       AND pm.papel IN ('coordenador','owner','lider')
  ) AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas coordenadores, owners ou líderes do projeto podem clonar fluxos';
  END IF;

  SELECT * INTO v_template FROM public.fluxo_aprovacao_config WHERE id = p_template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template não encontrado'; END IF;

  INSERT INTO public.fluxo_aprovacao_config(
    nome, checklist_tipo, descricao, ativo, created_by,
    projeto_id, template_origem_id, editavel_por_coordenador,
    oficializacao_modo, oficializacao_destino
  ) VALUES (
    COALESCE(p_nome, v_template.nome || ' (projeto)'), v_template.checklist_tipo,
    v_template.descricao, true, v_uid,
    p_projeto_id, v_template.id, true,
    v_template.oficializacao_modo, v_template.oficializacao_destino
  ) RETURNING id INTO v_novo_id;

  INSERT INTO public.fluxo_aprovacao_etapas(
    config_id, nome, nome_cn, ordem, tipo_aprovacao, responsavel_id,
    responsavel_secundario_id, destino_aprovacao_ordem, destino_reprovacao_ordem,
    ativo, tipo, pipeline_destino_id, sla_horas, sla_horas_uteis
  )
  SELECT v_novo_id, nome, nome_cn, ordem, tipo_aprovacao, responsavel_id,
         responsavel_secundario_id, destino_aprovacao_ordem, destino_reprovacao_ordem,
         ativo, tipo, pipeline_destino_id, sla_horas, sla_horas_uteis
    FROM public.fluxo_aprovacao_etapas WHERE config_id = p_template_id;

  RETURN v_novo_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_clonar_fluxo_para_projeto(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_clonar_fluxo_para_projeto(uuid,uuid,text) FROM PUBLIC, anon;

-- Delegar item
CREATE OR REPLACE FUNCTION public.rpc_delegar_item_aprovacao(
  p_item_id uuid,
  p_para_user_id uuid,
  p_comentario text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_item.status <> 'em_andamento' THEN RAISE EXCEPTION 'Item não está em andamento'; END IF;
  IF v_item.responsavel_atual_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Apenas o responsável atual pode delegar';
  END IF;
  IF p_para_user_id = v_uid THEN
    RAISE EXCEPTION 'Selecione outro membro para delegar';
  END IF;

  -- valida que o destinatário é membro do projeto (quando aplicável)
  IF v_item.projeto_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.projeto_membros WHERE projeto_id = v_item.projeto_id AND user_id = p_para_user_id) THEN
    RAISE EXCEPTION 'Destinatário não é membro do projeto';
  END IF;

  PERFORM set_config('app.kanban_audit_origem', 'delegacao', true);

  UPDATE public.aprovacao_documento_itens
     SET delegado_de = COALESCE(delegado_de, v_uid),
         delegado_em = now(),
         responsavel_atual_id = p_para_user_id,
         comentario_atual = COALESCE(p_comentario, comentario_atual),
         updated_at = now()
   WHERE id = p_item_id;

  PERFORM set_config('app.kanban_audit_origem', 'sistema', true);
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_delegar_item_aprovacao(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_delegar_item_aprovacao(uuid,uuid,text) FROM PUBLIC, anon;

-- Definir prazo manual
CREATE OR REPLACE FUNCTION public.rpc_definir_prazo_item(
  p_item_id uuid,
  p_prazo timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_pode boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  v_pode := (v_item.responsavel_atual_id = v_uid)
         OR (v_item.created_by = v_uid)
         OR public.has_role(v_uid, 'admin'::app_role)
         OR (v_item.projeto_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.projeto_membros pm
               WHERE pm.projeto_id = v_item.projeto_id AND pm.user_id = v_uid
                 AND pm.papel IN ('coordenador','owner','lider')));
  IF NOT v_pode THEN RAISE EXCEPTION 'Sem permissão para alterar o prazo'; END IF;

  UPDATE public.aprovacao_documento_itens
     SET prazo_em = p_prazo, updated_at = now()
   WHERE id = p_item_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_definir_prazo_item(uuid, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_definir_prazo_item(uuid, timestamptz) FROM PUBLIC, anon;

-- Oficializar documento (Cofre do Produto OU Cofre Genérico)
CREATE OR REPLACE FUNCTION public.rpc_oficializar_documento_cofre(
  p_item_id uuid,
  p_destino text,
  p_categoria_id uuid DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_doc record;
  v_novo_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_item.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Apenas documentos aprovados podem ser oficializados';
  END IF;
  IF v_item.oficializado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Documento já foi oficializado';
  END IF;
  IF p_destino NOT IN ('produto','generico') THEN
    RAISE EXCEPTION 'Destino inválido';
  END IF;

  SELECT id, nome_arquivo, arquivo_path, arquivo_url, tipo_documento, tamanho, produto_id
    INTO v_doc
    FROM public.china_produto_documentos
   WHERE id = v_item.documento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento de origem não encontrado'; END IF;

  IF p_destino = 'produto' THEN
    INSERT INTO public.fabrica_revisao_documentos(
      produto_id, nome_arquivo, arquivo_path, tipo_arquivo, tamanho,
      categoria, status, aprovado_por, aprovado_em, enviado_por, visivel_fabrica
    ) VALUES (
      COALESCE(p_produto_id, v_doc.produto_id),
      v_doc.nome_arquivo, v_doc.arquivo_path, COALESCE(v_doc.tipo_documento,'application/octet-stream'),
      COALESCE(v_doc.tamanho, 0), 'oficial', 'ativo', v_uid, now(), v_uid, true
    ) RETURNING id INTO v_novo_id;
  ELSE
    INSERT INTO public.cofre_generico_documentos(
      categoria_id, nome, arquivo_path, arquivo_url, mime_type, tamanho,
      origem_aprovacao_item_id, oficializado_por, oficializado_em
    ) VALUES (
      p_categoria_id, v_doc.nome_arquivo, v_doc.arquivo_path, v_doc.arquivo_url,
      v_doc.tipo_documento, v_doc.tamanho, p_item_id, v_uid, now()
    ) RETURNING id INTO v_novo_id;
  END IF;

  UPDATE public.aprovacao_documento_itens
     SET oficializado_em = now(), oficializado_destino = p_destino, updated_at = now()
   WHERE id = p_item_id;

  RETURN v_novo_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_oficializar_documento_cofre(uuid,text,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_oficializar_documento_cofre(uuid,text,uuid,uuid) FROM PUBLIC, anon;

-- =====================================================================
-- 5) TRIGGER: aplica SLA da etapa quando o item entra na etapa
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_aplicar_sla_etapa()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sla integer;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.etapa_atual_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.etapa_atual_id IS DISTINCT FROM OLD.etapa_atual_id) THEN
    SELECT sla_horas INTO v_sla FROM public.fluxo_aprovacao_etapas WHERE id = NEW.etapa_atual_id;
    IF v_sla IS NOT NULL AND v_sla > 0 AND NEW.prazo_em IS NULL THEN
      NEW.prazo_em := now() + (v_sla || ' hours')::interval;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_adi_sla_etapa ON public.aprovacao_documento_itens;
CREATE TRIGGER trg_adi_sla_etapa
BEFORE INSERT OR UPDATE OF etapa_atual_id ON public.aprovacao_documento_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_aplicar_sla_etapa();
