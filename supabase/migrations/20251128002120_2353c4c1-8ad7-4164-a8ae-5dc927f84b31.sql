-- Adicionar sistema de aprovação para tabelas de preço

-- 1. Adicionar campo status na tabela de tabelas de preço
ALTER TABLE fabrica_tabelas_preco 
ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'draft';

-- Adicionar constraint para validar status
ALTER TABLE fabrica_tabelas_preco
DROP CONSTRAINT IF EXISTS chk_tabelas_preco_status;

ALTER TABLE fabrica_tabelas_preco
ADD CONSTRAINT chk_tabelas_preco_status 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected'));

-- 2. Criar tabela de auditoria de tabelas de preço
CREATE TABLE IF NOT EXISTS fabrica_tabelas_preco_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES fabrica_tabelas_preco(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  acao varchar(50) NOT NULL,
  diff jsonb,
  mensagem text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_tabela ON fabrica_tabelas_preco_auditoria(tabela_id);
CREATE INDEX idx_audit_user ON fabrica_tabelas_preco_auditoria(user_id);
CREATE INDEX idx_audit_acao ON fabrica_tabelas_preco_auditoria(acao);
CREATE INDEX idx_audit_created ON fabrica_tabelas_preco_auditoria(created_at DESC);

-- 3. Criar tabela de versões de preços
CREATE TABLE IF NOT EXISTS fabrica_tabelas_preco_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES fabrica_tabelas_preco(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  precos_snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_versoes_tabela ON fabrica_tabelas_preco_versoes(tabela_id);
CREATE INDEX idx_versoes_tabela_versao ON fabrica_tabelas_preco_versoes(tabela_id, versao DESC);

-- 4. Trigger para criar versão automaticamente quando status muda para pending_approval
CREATE OR REPLACE FUNCTION criar_versao_tabela_preco()
RETURNS TRIGGER AS $$
DECLARE
  v_versao integer;
  v_precos jsonb;
BEGIN
  -- Só criar versão quando mudar para pending_approval
  IF NEW.status = 'pending_approval' AND (OLD.status IS NULL OR OLD.status != 'pending_approval') THEN
    -- Buscar última versão
    SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
    FROM fabrica_tabelas_preco_versoes
    WHERE tabela_id = NEW.id;
    
    -- Buscar snapshot dos preços atuais
    SELECT jsonb_agg(
      jsonb_build_object(
        'produto_id', produto_id,
        'custo_base', custo_base,
        'preco_final', preco_final,
        'margem_lucro', margem_lucro
      )
    ) INTO v_precos
    FROM fabrica_precos_produtos
    WHERE tabela_id = NEW.id;
    
    -- Criar nova versão
    INSERT INTO fabrica_tabelas_preco_versoes (
      tabela_id,
      versao,
      precos_snapshot,
      created_by
    ) VALUES (
      NEW.id,
      v_versao,
      COALESCE(v_precos, '[]'::jsonb),
      auth.uid()
    );
    
    -- Registrar na auditoria
    INSERT INTO fabrica_tabelas_preco_auditoria (
      tabela_id,
      user_id,
      acao,
      mensagem
    ) VALUES (
      NEW.id,
      auth.uid(),
      'pending_approval',
      'Tabela enviada para aprovação - Versão ' || v_versao
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_criar_versao_tabela_preco
  AFTER INSERT OR UPDATE OF status ON fabrica_tabelas_preco
  FOR EACH ROW
  EXECUTE FUNCTION criar_versao_tabela_preco();

-- 5. Trigger para registrar mudanças de status na auditoria
CREATE OR REPLACE FUNCTION auditar_mudanca_status_tabela()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO fabrica_tabelas_preco_auditoria (
      tabela_id,
      user_id,
      acao,
      diff,
      mensagem
    ) VALUES (
      NEW.id,
      auth.uid(),
      'status_change',
      jsonb_build_object(
        'status_anterior', OLD.status,
        'status_novo', NEW.status
      ),
      'Status alterado de ' || OLD.status || ' para ' || NEW.status
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auditar_status_tabela
  AFTER UPDATE OF status ON fabrica_tabelas_preco
  FOR EACH ROW
  EXECUTE FUNCTION auditar_mudanca_status_tabela();

-- 6. Trigger para mudar status para pending_approval quando preços são alterados
CREATE OR REPLACE FUNCTION marcar_tabela_pendente_aprovacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a tabela está aprovada e os preços mudaram, marcar como pendente
  UPDATE fabrica_tabelas_preco
  SET status = 'pending_approval'
  WHERE id = NEW.tabela_id 
    AND status = 'approved';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_preco_alterado_pendente
  AFTER INSERT OR UPDATE OR DELETE ON fabrica_precos_produtos
  FOR EACH ROW
  EXECUTE FUNCTION marcar_tabela_pendente_aprovacao();

-- 7. RLS Policies para auditoria
ALTER TABLE fabrica_tabelas_preco_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem toda auditoria"
  ON fabrica_tabelas_preco_auditoria
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- 8. RLS Policies para versões
ALTER TABLE fabrica_tabelas_preco_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem todas versões"
  ON fabrica_tabelas_preco_versoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- Comentários para documentação
COMMENT ON TABLE fabrica_tabelas_preco_auditoria IS 'Auditoria de todas as ações em tabelas de preço';
COMMENT ON TABLE fabrica_tabelas_preco_versoes IS 'Versionamento de snapshots de preços para comparação';
COMMENT ON COLUMN fabrica_tabelas_preco.status IS 'Status: draft, pending_approval, approved, rejected';