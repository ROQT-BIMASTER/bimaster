
CREATE TABLE public.cofre_produto_pastas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  cor text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (produto_id, nome)
);

CREATE INDEX idx_cofre_produto_pastas_produto ON public.cofre_produto_pastas(produto_id);
CREATE INDEX idx_cofre_produto_pastas_departamento ON public.cofre_produto_pastas(departamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cofre_produto_pastas TO authenticated;
GRANT ALL ON public.cofre_produto_pastas TO service_role;

ALTER TABLE public.cofre_produto_pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cofre_pastas_select" ON public.cofre_produto_pastas
  FOR SELECT TO authenticated
  USING (public.can_access_fabrica((SELECT auth.uid())));

CREATE POLICY "cofre_pastas_insert" ON public.cofre_produto_pastas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_fabrica((SELECT auth.uid())) AND criado_por = (SELECT auth.uid()));

CREATE POLICY "cofre_pastas_update" ON public.cofre_produto_pastas
  FOR UPDATE TO authenticated
  USING (public.can_access_fabrica((SELECT auth.uid())))
  WITH CHECK (public.can_access_fabrica((SELECT auth.uid())));

CREATE POLICY "cofre_pastas_delete" ON public.cofre_produto_pastas
  FOR DELETE TO authenticated
  USING (
    public.can_access_fabrica((SELECT auth.uid()))
    AND (criado_por = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::app_role))
  );

CREATE TRIGGER trg_cofre_produto_pastas_updated_at
  BEFORE UPDATE ON public.cofre_produto_pastas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna direta de pasta no documento do cofre (além do metadata)
ALTER TABLE public.fabrica_revisao_documentos
  ADD COLUMN IF NOT EXISTS pasta_id uuid REFERENCES public.cofre_produto_pastas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fabrica_revisao_documentos_pasta
  ON public.fabrica_revisao_documentos(pasta_id);
