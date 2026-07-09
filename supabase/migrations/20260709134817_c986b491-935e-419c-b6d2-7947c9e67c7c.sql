
-- (a) Unicidade de CNPJ no cadastro
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_cnpj_digits
  ON public.empresas (cnpj_digits)
  WHERE cnpj_digits IS NOT NULL AND length(cnpj_digits) = 14;

-- (b) Coluna de vínculo
ALTER TABLE public.erp_vendas
  ADD COLUMN IF NOT EXISTS empresa_destino_id bigint REFERENCES public.empresas(id);

CREATE INDEX IF NOT EXISTS idx_erp_vendas_empresa_destino
  ON public.erp_vendas (empresa_destino_id) WHERE empresa_destino_id IS NOT NULL;

-- (c) Resolução automática no sync
CREATE OR REPLACE FUNCTION public.erp_vendas_resolver_destino()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj text := regexp_replace(coalesce(NEW.cliente_cnpj_cpf, ''), '\D', '', 'g');
BEGIN
  IF length(v_cnpj) = 14 THEN
    SELECT e.id INTO NEW.empresa_destino_id
    FROM public.empresas e
    WHERE e.cnpj_digits = v_cnpj;
  ELSE
    NEW.empresa_destino_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.erp_vendas_resolver_destino() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_erp_vendas_resolver_destino ON public.erp_vendas;
CREATE TRIGGER trg_erp_vendas_resolver_destino
  BEFORE INSERT OR UPDATE OF cliente_cnpj_cpf ON public.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION public.erp_vendas_resolver_destino();

-- (d) Backfill do histórico
UPDATE public.erp_vendas v
SET empresa_destino_id = e.id
FROM public.empresas e
WHERE e.cnpj_digits = regexp_replace(coalesce(v.cliente_cnpj_cpf, ''), '\D', '', 'g')
  AND length(e.cnpj_digits) = 14
  AND v.empresa_destino_id IS DISTINCT FROM e.id;

-- (e) Religar vendas quando CNPJ de empresa é cadastrado/corrigido
CREATE OR REPLACE FUNCTION public.empresas_religar_vendas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cnpj_digits IS NOT NULL AND length(NEW.cnpj_digits) = 14
     AND (TG_OP = 'INSERT' OR NEW.cnpj_digits IS DISTINCT FROM OLD.cnpj_digits) THEN
    UPDATE public.erp_vendas v
    SET empresa_destino_id = NEW.id
    WHERE regexp_replace(coalesce(v.cliente_cnpj_cpf, ''), '\D', '', 'g') = NEW.cnpj_digits
      AND v.empresa_destino_id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.empresas_religar_vendas() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_empresas_religar_vendas ON public.empresas;
CREATE TRIGGER trg_empresas_religar_vendas
  AFTER INSERT OR UPDATE OF cnpj_digits ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.empresas_religar_vendas();

-- (f) RLS aditiva: destinatário também enxerga
CREATE POLICY erp_vendas_select_destino ON public.erp_vendas
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid() AND ue.empresa_id = erp_vendas.empresa_destino_id
  )
);

CREATE POLICY erp_vendas_item_select_destino ON public.erp_vendas_item
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.erp_vendas v
    JOIN public.user_empresas ue ON ue.empresa_id = v.empresa_destino_id
    WHERE v.futura_nota_id = erp_vendas_item.futura_nota_id
      AND ue.user_id = auth.uid()
  )
);

-- (g) View de compras (entrada nas distribuidoras)
CREATE OR REPLACE VIEW public.erp_compras
WITH (security_invoker = true) AS
SELECT
  v.id                 AS venda_id,
  v.futura_nota_id,
  v.nro_nota,
  v.serie,
  v.modelo_doc,
  v.cfop_id,
  v.data_emissao       AS data_entrada,
  v.empresa_destino_id AS empresa_id,
  e.nome               AS empresa_nome,
  v.empresa_id         AS fornecedor_empresa_futura_id,
  v.quantidade,
  v.total_produto,
  v.total_desconto,
  v.total_nota,
  v.status,
  v.sincronizado_em
FROM public.erp_vendas v
JOIN public.empresas e ON e.id = v.empresa_destino_id
WHERE v.status = 1;
