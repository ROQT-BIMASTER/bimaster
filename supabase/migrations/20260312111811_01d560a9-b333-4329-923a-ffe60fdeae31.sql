
-- =============================================
-- Sistema de Papéis e Permissões - Dev Produtos
-- =============================================

-- 1. Tabela de versões de documentos
CREATE TABLE public.produto_documento_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  arquivo_path TEXT NOT NULL,
  tamanho BIGINT,
  enviado_por UUID,
  status TEXT NOT NULL DEFAULT 'rascunho',
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  observacoes TEXT,
  versao_oficial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de status do processo por produto
CREATE TABLE public.produto_dev_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submissao_criada',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(produto_id, projeto_id)
);

-- 3. Tabela de auditoria de documentos
CREATE TABLE public.produto_doc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID,
  versao_id UUID,
  produto_id UUID,
  projeto_id UUID,
  acao TEXT NOT NULL,
  user_id UUID,
  user_name TEXT,
  detalhes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produto_documento_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_dev_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_doc_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function: has_dev_papel
CREATE OR REPLACE FUNCTION public.has_dev_papel(
  _user_id UUID, _projeto_id UUID, _papel TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros
    WHERE user_id = _user_id 
      AND projeto_id = _projeto_id
      AND papel = _papel
  )
$$;

-- 5. Can publish to cofre (admin_cofre or admin role)
CREATE OR REPLACE FUNCTION public.can_publish_to_cofre(_user_id UUID, _projeto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros
    WHERE user_id = _user_id 
      AND projeto_id = _projeto_id
      AND papel IN ('admin_cofre', 'coordenador', 'gestor_produto')
  )
  OR public.has_role(_user_id, 'admin')
$$;

-- 6. Can approve doc (gestor_produto, regulatorio, controle_arte)
CREATE OR REPLACE FUNCTION public.can_approve_doc(_user_id UUID, _projeto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros
    WHERE user_id = _user_id 
      AND projeto_id = _projeto_id
      AND papel IN ('gestor_produto', 'regulatorio', 'controle_arte', 'coordenador')
  )
  OR public.has_role(_user_id, 'admin')
$$;

-- 7. RLS Policies for produto_documento_versoes
CREATE POLICY "versoes_select" ON public.produto_documento_versoes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "versoes_insert" ON public.produto_documento_versoes
FOR INSERT TO authenticated WITH CHECK (enviado_por = auth.uid());

CREATE POLICY "versoes_update" ON public.produto_documento_versoes
FOR UPDATE TO authenticated USING (enviado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 8. RLS Policies for produto_dev_status
CREATE POLICY "dev_status_select" ON public.produto_dev_status
FOR SELECT TO authenticated USING (true);

CREATE POLICY "dev_status_insert" ON public.produto_dev_status
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "dev_status_update" ON public.produto_dev_status
FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- 9. RLS Policies for produto_doc_audit_log
CREATE POLICY "audit_log_select" ON public.produto_doc_audit_log
FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_log_insert" ON public.produto_doc_audit_log
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
