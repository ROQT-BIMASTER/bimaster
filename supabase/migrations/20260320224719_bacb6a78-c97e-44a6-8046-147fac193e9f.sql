-- Migration 1: New tables + lookup tables + seed data + contas_bancarias alterations

-- A3. parcelas_receber
CREATE TABLE IF NOT EXISTS parcelas_receber (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID,
  conta_receber_id  UUID          NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  numero_parcela    SMALLINT      NOT NULL DEFAULT 1,
  descricao         VARCHAR(100),
  data_vencimento   DATE          NOT NULL,
  data_recebimento  DATE,
  valor_original    NUMERIC(15,2) NOT NULL,
  valor_desconto    NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_juros       NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_recebido    NUMERIC(15,2) NOT NULL DEFAULT 0,
  conta_bancaria_id UUID,
  recebimento_id    UUID,
  codigo_barras     VARCHAR(100),
  status            VARCHAR(20)   NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','recebido','cancelado','vencido')),
  observacoes       TEXT,
  bloqueado         BOOLEAN       NOT NULL DEFAULT FALSE,
  inativo           BOOLEAN       NOT NULL DEFAULT FALSE,
  data_inc          DATE          DEFAULT CURRENT_DATE,
  hora_inc          TIME          DEFAULT CURRENT_TIME,
  user_inc          VARCHAR(50),
  data_alt          DATE,
  hora_alt          TIME,
  user_alt          VARCHAR(50),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_par_rec_titulo  ON parcelas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_par_rec_status  ON parcelas_receber(status);
CREATE INDEX IF NOT EXISTS idx_par_rec_venc    ON parcelas_receber(data_vencimento);
GRANT SELECT, INSERT, UPDATE ON parcelas_receber TO anon, authenticated;

-- A4. recebimentos
CREATE TABLE IF NOT EXISTS recebimentos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID,
  parcela_receber_id  UUID          REFERENCES parcelas_receber(id),
  conta_bancaria_id   UUID,
  data_recebimento    DATE          NOT NULL DEFAULT CURRENT_DATE,
  valor_recebido      NUMERIC(15,2) NOT NULL,
  valor_desconto      NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_juros         NUMERIC(15,2) NOT NULL DEFAULT 0,
  forma_recebimento   VARCHAR(30)   NOT NULL DEFAULT 'transferencia',
  numero_documento    VARCHAR(50),
  autenticacao        VARCHAR(100),
  observacoes         TEXT,
  status              VARCHAR(20)   NOT NULL DEFAULT 'confirmado',
  data_inc            DATE          DEFAULT CURRENT_DATE,
  hora_inc            TIME          DEFAULT CURRENT_TIME,
  user_inc            VARCHAR(50),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rec_parcela ON recebimentos(parcela_receber_id);
CREATE INDEX IF NOT EXISTS idx_rec_data    ON recebimentos(data_recebimento);
GRANT SELECT, INSERT, UPDATE ON recebimentos TO anon, authenticated;

-- A5. lancamentos_conta_corrente
CREATE TABLE IF NOT EXISTS lancamentos_conta_corrente (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID          NOT NULL,
  conta_bancaria_id   UUID          NOT NULL,
  tipo                VARCHAR(10)   NOT NULL CHECK (tipo IN ('credito','debito')),
  data_lancamento     DATE          NOT NULL DEFAULT CURRENT_DATE,
  data_competencia    DATE,
  valor               NUMERIC(15,2) NOT NULL,
  descricao           VARCHAR(255)  NOT NULL,
  categoria           VARCHAR(50),
  plano_conta_id      UUID,
  centro_custo_id     UUID,
  numero_documento    VARCHAR(50),
  origem              VARCHAR(30)   NOT NULL DEFAULT 'manual'
                      CHECK (origem IN ('manual','pagamento','recebimento','transferencia','tarifa','ajuste','importacao')),
  titulo_pagar_id     UUID,
  titulo_receber_id   UUID,
  conta_destino_id    UUID,
  lancamento_par_id   UUID,
  observacoes         TEXT,
  codigo_integracao   VARCHAR(100),
  enviado_erp         BOOLEAN       NOT NULL DEFAULT FALSE,
  inativo             BOOLEAN       NOT NULL DEFAULT FALSE,
  data_inc            DATE          DEFAULT CURRENT_DATE,
  hora_inc            TIME          DEFAULT CURRENT_TIME,
  user_inc            VARCHAR(50),
  data_alt            DATE,
  hora_alt            TIME,
  user_alt            VARCHAR(50),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lcc_empresa ON lancamentos_conta_corrente(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lcc_conta   ON lancamentos_conta_corrente(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_lcc_data    ON lancamentos_conta_corrente(data_lancamento);
GRANT SELECT, INSERT, UPDATE ON lancamentos_conta_corrente TO anon, authenticated;

-- B1. bancos
CREATE TABLE IF NOT EXISTS bancos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_compe VARCHAR(3)  UNIQUE,
  ispb         VARCHAR(8),
  nome         VARCHAR(100) NOT NULL,
  nome_curto   VARCHAR(30),
  ativo        BOOLEAN     NOT NULL DEFAULT TRUE
);
INSERT INTO bancos (codigo_compe, ispb, nome, nome_curto) VALUES
  ('001','00000000','Banco do Brasil S.A.','BB'),
  ('033','90400888','Banco Santander (Brasil) S.A.','Santander'),
  ('077','00416968','Banco Inter S.A.','Inter'),
  ('104','00360305','Caixa Econômica Federal','CEF'),
  ('197','16501555','Stone Pagamentos S.A.','Stone'),
  ('208','60746948','Banco BTG Pactual S.A.','BTG'),
  ('212','92894922','Banco Original S.A.','Original'),
  ('237','60746948','Banco Bradesco S.A.','Bradesco'),
  ('260','18236120','Nu Pagamentos S.A. (Nubank)','Nubank'),
  ('290','67930944','PagSeguro Internet S.A.','PagBank'),
  ('341','60701190','Itaú Unibanco S.A.','Itaú'),
  ('380','22896431','PicPay Serviços S.A.','PicPay'),
  ('422','58160789','Banco Safra S.A.','Safra'),
  ('655','92702067','Banco Votorantim S.A.','BV'),
  ('756','02038232','Sicoob','Sicoob')
ON CONFLICT (codigo_compe) DO NOTHING;
GRANT SELECT ON bancos TO anon, authenticated;

-- B2. tipos_documento
CREATE TABLE IF NOT EXISTS tipos_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descricao VARCHAR(50) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO tipos_documento (codigo, descricao) VALUES
  ('NF','Nota Fiscal'),('NFE','NF-e (Eletrônica)'),('NFSE','NFS-e (Serviços)'),
  ('NFCE','NFC-e (Consumidor)'),('RECIBO','Recibo'),('BOLETO','Boleto Bancário'),
  ('CONTRATO','Contrato'),('FATURA','Fatura'),('DUPLICATA','Duplicata'),
  ('DEBITO','Débito Automático'),('OUTROS','Outros')
ON CONFLICT (codigo) DO NOTHING;
GRANT SELECT ON tipos_documento TO anon, authenticated;

-- B3. tipos_conta_corrente
CREATE TABLE IF NOT EXISTS tipos_conta_corrente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descricao VARCHAR(50) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO tipos_conta_corrente (codigo, descricao) VALUES
  ('CC','Conta Corrente'),('CP','Conta Poupança'),('CI','Conta de Investimento'),
  ('CS','Conta Salário'),('CARTAO','Cartão de Crédito'),('CAIXA','Caixa Interno'),('OUTROS','Outros')
ON CONFLICT (codigo) DO NOTHING;
GRANT SELECT ON tipos_conta_corrente TO anon, authenticated;

-- B4. origens_titulo
CREATE TABLE IF NOT EXISTS origens_titulo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descricao VARCHAR(60) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO origens_titulo (codigo, descricao) VALUES
  ('MANUAL','Lançamento Manual'),('CENTRAL','Central de Pagamentos'),
  ('API','Importado via API'),('NF','Nota Fiscal Importada'),
  ('CONTRATO','Gerado por Contrato'),('RECORRENTE','Lançamento Recorrente'),
  ('IMPORTACAO','Importação em Lote')
ON CONFLICT (codigo) DO NOTHING;
GRANT SELECT ON origens_titulo TO anon, authenticated;

-- B5. bandeiras_cartao
CREATE TABLE IF NOT EXISTS bandeiras_cartao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descricao VARCHAR(30) NOT NULL,
  tipo VARCHAR(10) NOT NULL DEFAULT 'ambos' CHECK (tipo IN ('debito','credito','ambos')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO bandeiras_cartao (codigo, descricao, tipo) VALUES
  ('VISA','Visa','ambos'),('MASTER','Mastercard','ambos'),('ELO','Elo','ambos'),
  ('AMEX','American Express','credito'),('HIPER','Hipercard','credito'),
  ('CABAL','Cabal','ambos'),('DINERS','Diners Club','credito'),('BANESCARD','Banescard','credito')
ON CONFLICT (codigo) DO NOTHING;
GRANT SELECT ON bandeiras_cartao TO anon, authenticated;

-- B6. finalidades_transferencia
CREATE TABLE IF NOT EXISTS finalidades_transferencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descricao VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO finalidades_transferencia (codigo, descricao) VALUES
  ('01','Crédito em Conta'),('02','Pagamento a Fornecedor'),('03','Pagamento de Salário'),
  ('04','Pagamento de Tributos'),('05','Pagamento de Concessionárias'),('06','Outros'),
  ('10','PIX — transferência'),('11','PIX — pagamento de QR Code')
ON CONFLICT (codigo) DO NOTHING;
GRANT SELECT ON finalidades_transferencia TO anon, authenticated;

-- C. Complementar contas_bancarias (agencia already exists, conta already exists)
ALTER TABLE contas_bancarias
  ADD COLUMN IF NOT EXISTS tipo_conta VARCHAR(20) DEFAULT 'CC',
  ADD COLUMN IF NOT EXISTS numero_conta VARCHAR(20),
  ADD COLUMN IF NOT EXISTS digito VARCHAR(2),
  ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_saldo_inicial DATE,
  ADD COLUMN IF NOT EXISTS saldo_atual NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_integracao VARCHAR(100),
  ADD COLUMN IF NOT EXISTS enviado_erp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_inc DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS hora_inc TIME DEFAULT CURRENT_TIME,
  ADD COLUMN IF NOT EXISTS user_inc VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_alt DATE,
  ADD COLUMN IF NOT EXISTS hora_alt TIME,
  ADD COLUMN IF NOT EXISTS user_alt VARCHAR(50);
GRANT SELECT, INSERT, UPDATE ON contas_bancarias TO anon, authenticated;