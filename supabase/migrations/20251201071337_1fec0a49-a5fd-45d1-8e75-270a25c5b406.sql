-- Habilitar RLS na tabela account_classification_rules
ALTER TABLE account_classification_rules ENABLE ROW LEVEL SECURITY;

-- Política para admins e supervisores verem todas as regras
CREATE POLICY "Admins e supervisores podem ver regras de classificação"
ON account_classification_rules
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
);

-- Política para admins e supervisores criarem regras
CREATE POLICY "Admins e supervisores podem criar regras de classificação"
ON account_classification_rules
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_supervisor(auth.uid())
);

-- Política para admins e supervisores atualizarem regras
CREATE POLICY "Admins e supervisores podem atualizar regras de classificação"
ON account_classification_rules
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
);

-- Política para admins deletarem regras
CREATE POLICY "Admins podem deletar regras de classificação"
ON account_classification_rules
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);