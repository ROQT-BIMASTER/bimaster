-- Adicionar campos bancários na tabela de fornecedores
ALTER TABLE public.fabrica_fornecedores
ADD COLUMN IF NOT EXISTS banco VARCHAR(100),
ADD COLUMN IF NOT EXISTS agencia VARCHAR(20),
ADD COLUMN IF NOT EXISTS conta VARCHAR(30),
ADD COLUMN IF NOT EXISTS tipo_conta VARCHAR(20) DEFAULT 'corrente',
ADD COLUMN IF NOT EXISTS pix_chave VARCHAR(100),
ADD COLUMN IF NOT EXISTS pix_tipo VARCHAR(20),
ADD COLUMN IF NOT EXISTS linha_digitavel TEXT,
ADD COLUMN IF NOT EXISTS favorecido VARCHAR(200);

-- Criar bucket para documentos de despesas de eventos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-expense-docs', 'event-expense-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Política para upload de documentos de despesas
CREATE POLICY "Authenticated users can upload expense docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-expense-docs');

-- Política para visualizar documentos de despesas
CREATE POLICY "Authenticated users can view expense docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'event-expense-docs');

-- Política para deletar documentos de despesas
CREATE POLICY "Authenticated users can delete expense docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-expense-docs');

-- Adicionar campo para armazenar URLs dos documentos anexados nas despesas
ALTER TABLE public.corporate_event_expenses
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;