
CREATE TABLE planos_reducao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  status text DEFAULT 'ativo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE planos_reducao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público planos_reducao" ON planos_reducao FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE contas_pagar_revisao ADD COLUMN plano_id uuid REFERENCES planos_reducao(id);

INSERT INTO planos_reducao (id, nome, descricao) 
VALUES (gen_random_uuid(), 'Redução Departamento de TI', 'Plano de redução de gastos do departamento de Tecnologia da Informação');

UPDATE contas_pagar_revisao SET plano_id = (SELECT id FROM planos_reducao LIMIT 1) WHERE plano_id IS NULL;
