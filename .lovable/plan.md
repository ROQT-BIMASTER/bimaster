

# Planejamento Arquitetônico — Consolidação ERP (Visão Completa)

## Contexto

O sistema evoluiu de BI para front-end principal do ERP. As APIs Omie-style foram criadas como referência de integração. Agora é preciso: (1) auditar todos os endpoints existentes, (2) garantir que as tabelas suportam todos os campos dos JSONs, (3) alinhar sem quebrar produção, (4) preparar para construção de telas de cadastro.

---

## Inventário: 22 Edge Functions ERP + Tabelas Correspondentes

### GRUPO 1 — Completos (API + Tabela robusta, prontos para telas)

| # | Edge Function | Tabela DB | Status |
|---|---|---|---|
| 1 | `contas-pagar-api` (21 rotas) | `contas_pagar` (90+ colunas) | **OK** — Tabela já possui todos os campos Omie (impostos, CNAB, boleto, rateios, parcelas). |
| 2 | `contas-receber-api` (18 rotas) | `contas_receber` (100+ colunas) | **OK** — Campos completos incluindo boleto, rateio, impostos retidos. |
| 3 | `boletos-api` (5 rotas) | `boletos` (20+ colunas) | **OK** — Tabela dedicada com todos os campos Omie. |
| 4 | `lancamentos-cc-api` (8 rotas + extrato) | `lancamentos_cc` | **VERIFICAR** — Tabela não encontrada no types.ts. Pode estar usando nome diferente ou ser criada sob demanda. |
| 5 | `contas-correntes-api` (10 rotas) | `portadores` (12 colunas) | **GAP** — Tabela `portadores` é simplificada. Faltam ~15 campos Omie (saldo_inicial, valor_limite, pix_sn, bol_sn, tipo_conta_corrente, codigo_integracao, etc.). |
| 6 | `clientes-api` (9 rotas + caract + tags) | `clientes` (50+ colunas) + `cliente_caracteristicas` + `cliente_tags` | **OK** — Tabela robusta. Campos auxiliares criados. |
| 7 | `projetos-api` (6 rotas) | `projetos` + coluna `codigo_integracao` | **OK** — Migration já aplicada. |
| 8 | `empresas-api` (2 rotas) | `empresas` (6 colunas) | **GAP** — Tabela ultra-simplificada. Faltam ~50 campos Omie (endereco, telefone, inscricoes, regime tributario, SPED, certificados, etc.). |

### GRUPO 2 — Tabelas de Lookup (read-only, já funcionais)

| # | Edge Function | Tabela DB | Status |
|---|---|---|---|
| 9 | `bancos-api` | `bancos` | **OK** |
| 10 | `bandeiras-api` | `bandeiras_cartao` | **OK** |
| 11 | `finalidades-transferencia-api` | `finalidades_transferencia` | **OK** |
| 12 | `origens-api` | `origens_lancamento` | **OK** |
| 13 | `tipos-documento-api` | `tipos_documento` | **OK** |
| 14 | `dre-cadastro-api` | `plano_contas` | **OK** |

### GRUPO 3 — APIs Compostas/Relatório (read-only, sem tabela própria)

| # | Edge Function | Fonte | Status |
|---|---|---|---|
| 15 | `resumo-financeiro-api` | CP + CR + Portadores | **OK** — Consolida dados existentes |
| 16 | `movimentos-financeiros-api` | CP + CR + Lancamentos CC | **OK** — Query unificada |
| 17 | `pesquisar-lancamentos-api` | CP + CR | **OK** |
| 18 | `orcamentos-caixa-api` | Calculado | **VERIFICAR** — Pode precisar de tabela `orcamento_caixa` para valores previstos |

### GRUPO 4 — APIs de Integração/Sync (server-to-server)

| # | Edge Function | Status |
|---|---|---|
| 19 | `contas-pagar-export-api` | **OK** — Export para ERP |
| 20 | `erp-webhook-inbound` | **OK** — Webhook receptor |
| 21 | `erp-plano-contas-api` | **OK** — Sync plano de contas |
| 22 | `erp-portadores-api` | **OK** — Sync portadores |
| 23 | `erp-fornecedores-query` | **OK** — Query fornecedores |
| 24 | `anexos-api` | `documento_anexos` | **OK** |

---

## Gaps Identificados — O que Precisa Ser Feito

### GAP 1: Tabela `portadores` → Expandir para Contas Correntes completas

A API `contas-correntes-api` expõe campos ricos (saldo_inicial, valor_limite, pix_sn, bol_sn, tipo_conta_corrente, codigo_integracao, fluxo_caixa_sn, etc.) mas a tabela `portadores` tem apenas 12 colunas básicas.

**Ação**: Migration para adicionar ~15 colunas à tabela `portadores`:
- `codigo_integracao varchar(20) UNIQUE`
- `saldo_inicial decimal DEFAULT 0`
- `valor_limite decimal DEFAULT 0`
- `tipo_conta_corrente varchar(5) DEFAULT 'CC'`
- `pix_sn varchar(1) DEFAULT 'N'`
- `bol_sn varchar(1) DEFAULT 'N'`
- `fluxo_caixa_sn varchar(1) DEFAULT 'S'`
- `resumo_executivo_sn varchar(1) DEFAULT 'S'`
- `importado_api boolean DEFAULT false`
- `codigo_omie integer`

### GAP 2: Tabela `empresas` → Expandir para Cadastro Completo

A tabela tem apenas `id, nome, cnpj, uf, ativa, created_at`. O cadastro Omie tem 100+ campos.

**Ação**: Migration para adicionar campos essenciais (não todos os 100+, apenas os operacionalmente necessários):
- `codigo_empresa_integracao varchar(20)`
- `nome_fantasia varchar(60)`
- `logradouro varchar(6)`, `endereco varchar(50)`, `endereco_numero varchar(5)`, `complemento varchar(60)`
- `bairro varchar(60)`, `cidade varchar(40)`, `cep varchar(9)`
- `telefone1_ddd varchar(5)`, `telefone1_numero varchar(15)`
- `email varchar(200)`, `website varchar(100)`
- `cnae varchar(7)`, `inscricao_estadual varchar(20)`, `inscricao_municipal varchar(20)`
- `regime_tributario varchar(1)`, `optante_simples_nacional varchar(1)`
- `updated_at timestamptz`
- `importado_api boolean DEFAULT false`

### GAP 3: Tabela `lancamentos_cc` — Verificar/Criar

A API `lancamentos-cc-api` precisa de uma tabela para lançamentos de conta corrente. Se não existir, criar:

**Ação**: Verificar existência. Se ausente, criar com os campos do JSON da API (n_cod_lanc, codigo_integracao, conta_corrente_id, data_lancamento, valor, tipo_documento, categoria_codigo, cliente_id, observacoes, natureza, origem, etc.).

### GAP 4: Tabela `orcamento_caixa` — Verificar/Criar

A API `orcamentos-caixa-api` grava orçamentos previstos. Precisa de tabela para persistir.

**Ação**: Verificar existência. Se ausente, criar com campos: `ano, mes, categoria_codigo, categoria_descricao, valor_previsto`.

### GAP 5: Tabela `fornecedores` — Expandir

A tabela tem apenas 13 colunas básicas. Para uso como cadastro front-end do ERP, precisa de campos adicionais (endereço completo, inscrição estadual/municipal, dados bancários, contato, etc.).

**Ação**: Migration para adicionar ~20 colunas essenciais.

---

## Plano de Execução (5 Fases)

### Fase 1 — Migrations de Schema (sem quebrar produção)
Todas as alterações são **ADD COLUMN IF NOT EXISTS** — zero risco para produção.

1. Expandir `portadores` (+15 colunas)
2. Expandir `empresas` (+18 colunas)
3. Expandir `fornecedores` (+20 colunas)
4. Criar `lancamentos_cc` se não existir
5. Criar `orcamento_caixa` se não existir

### Fase 2 — Atualizar Edge Functions
Ajustar as Edge Functions que mapeavam campos como "vazio" para agora ler/gravar nas novas colunas:
1. `empresas-api` — mapear novos campos
2. `contas-correntes-api` — mapear novos campos de `portadores`
3. `lancamentos-cc-api` — ajustar tabela alvo se necessário

### Fase 3 — Atualizar ApiTester + ApiDocumentation
Garantir que todos os presets refletem os campos reais.

### Fase 4 — Atualizar Documentação
Revisar todos os `docs/API_*.md` para refletir campos reais (não mais "retornados como vazio").

### Fase 5 — Preparar para Telas de Cadastro (próximo passo)
Com tabelas completas e APIs funcionais, construir telas CRUD para:
- Cadastro de Empresas
- Cadastro de Fornecedores
- Cadastro de Contas Correntes (Portadores)
- Gestão de Lançamentos CC
- Orçamento de Caixa

---

## Resumo Executivo

- **22 APIs ERP** mapeadas e documentadas
- **5 gaps** identificados (tabelas simplificadas ou ausentes)
- **Zero risco** para produção (apenas ADD COLUMN + CREATE TABLE IF NOT EXISTS)
- **Prioridade**: Portadores → Empresas → Fornecedores → Lancamentos CC → Orçamento Caixa

Deseja aprovar para iniciar a Fase 1 (migrations de schema)?

