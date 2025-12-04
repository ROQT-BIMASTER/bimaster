-- Add status_lancamento column to fabrica_produtos
ALTER TABLE fabrica_produtos 
ADD COLUMN IF NOT EXISTS status_lancamento VARCHAR(50) DEFAULT 'pendente';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_status_lancamento 
ON fabrica_produtos(status_lancamento);

-- Create launch templates table
CREATE TABLE IF NOT EXISTS fabrica_templates_lancamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  tarefas JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE fabrica_templates_lancamento ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Templates visíveis para usuários autenticados"
ON fabrica_templates_lancamento FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Templates editáveis por usuários autenticados"
ON fabrica_templates_lancamento FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert default templates
INSERT INTO fabrica_templates_lancamento (nome, descricao, tarefas) VALUES
(
  'Template Padrão',
  'Tarefas básicas de marketing para lançamento',
  '[
    {"tipo": "post_social", "titulo": "Post Feed Instagram/Facebook", "descricao": "Criar post para feed das redes sociais"},
    {"tipo": "stories", "titulo": "Stories de Lançamento", "descricao": "Sequência de stories apresentando o produto"},
    {"tipo": "email_marketing", "titulo": "Email Marketing", "descricao": "Disparo de email para base de clientes"}
  ]'::jsonb
),
(
  'Template Premium',
  'Pacote completo de marketing para lançamentos importantes',
  '[
    {"tipo": "post_social", "titulo": "Post Feed Instagram/Facebook", "descricao": "Criar post para feed das redes sociais"},
    {"tipo": "stories", "titulo": "Stories de Lançamento", "descricao": "Sequência de stories apresentando o produto"},
    {"tipo": "reels", "titulo": "Reels/Vídeo Curto", "descricao": "Vídeo dinâmico mostrando o produto"},
    {"tipo": "email_marketing", "titulo": "Email Marketing", "descricao": "Disparo de email para base de clientes"},
    {"tipo": "video", "titulo": "Vídeo Institucional", "descricao": "Vídeo completo de apresentação do produto"},
    {"tipo": "catalogo", "titulo": "Atualização Catálogo", "descricao": "Adicionar produto ao catálogo digital"},
    {"tipo": "banner", "titulo": "Banners Web/App", "descricao": "Banners para site e aplicativo"}
  ]'::jsonb
),
(
  'Template Express',
  'Lançamento rápido com mínimo de tarefas',
  '[
    {"tipo": "post_social", "titulo": "Post Feed Instagram/Facebook", "descricao": "Criar post para feed das redes sociais"},
    {"tipo": "banner", "titulo": "Banner Principal", "descricao": "Banner para destaque no site"}
  ]'::jsonb
);

-- Update existing products to have status based on whether they have a launch
UPDATE fabrica_produtos fp
SET status_lancamento = 'agendado'
WHERE EXISTS (
  SELECT 1 FROM lancamentos_produtos lp 
  WHERE lp.produto_id = fp.id 
  AND lp.status != 'cancelado'
);

UPDATE fabrica_produtos fp
SET status_lancamento = 'lancado'
WHERE EXISTS (
  SELECT 1 FROM lancamentos_produtos lp 
  WHERE lp.produto_id = fp.id 
  AND lp.status = 'lancado'
);