-- Adicionar campos de evidências e observações caso não existam
DO $$ 
BEGIN
  -- Adicionar document_url se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trade_financial_entries' AND column_name = 'document_url'
  ) THEN
    ALTER TABLE trade_financial_entries 
    ADD COLUMN document_url text;
  END IF;

  -- Adicionar notes se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trade_financial_entries' AND column_name = 'notes'
  ) THEN
    ALTER TABLE trade_financial_entries 
    ADD COLUMN notes text;
  END IF;
END $$;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Criadores podem atualizar evidências de lançamentos aprovados" ON trade_financial_entries;
DROP POLICY IF EXISTS "Admins e supervisores podem aprovar lançamentos" ON trade_financial_entries;

-- Policy para criadores atualizarem evidências após aprovação
CREATE POLICY "Criadores podem atualizar evidências de lançamentos aprovados"
ON trade_financial_entries
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() 
  AND approval_status = 'approved'
)
WITH CHECK (
  created_by = auth.uid() 
  AND approval_status = 'approved'
);

-- Policy para admins e supervisores aprovarem lançamentos
CREATE POLICY "Admins e supervisores podem aprovar lançamentos"
ON trade_financial_entries
FOR UPDATE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()))
WITH CHECK (is_admin_or_supervisor(auth.uid()));