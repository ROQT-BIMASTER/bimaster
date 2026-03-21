

# API Contas a Receber — Padronização Omie

## Resumo

Expandir a tabela `contas_receber` com campos Omie faltantes (impostos, CNAB, boleto, rateios, repetição), adicionar rotas Omie-style na Edge Function existente e documentar tudo — seguindo o mesmo padrão das APIs de Contas a Pagar, Contas Correntes e Lançamentos CC.

## 1. Expansão da tabela `contas_receber`

A tabela já possui campos básicos. Migração para adicionar campos Omie faltantes:

| Campo | Tipo | Descrição |
|---|---|---|
| `codigo_lancamento_omie` | BIGINT | Código do lançamento no Omie |
| `codigo_lancamento_integracao` | VARCHAR(60) | Código de integração Omie |
| `codigo_cliente_fornecedor` | BIGINT | Código do cliente no Omie |
| `codigo_cliente_fornecedor_integracao` | VARCHAR(60) | Código integração do cliente |
| `data_previsao` | DATE | Data de previsão de recebimento |
| `data_registro` | DATE | Data de registro |
| `id_conta_corrente` | BIGINT | Conta corrente vinculada |
| `codigo_projeto` | INTEGER | Código do projeto |
| `codigo_vendedor` | INTEGER | Código do vendedor |
| `numero_pedido` | VARCHAR(15) | Número do pedido |
| `codigo_tipo_documento` | VARCHAR(5) | Tipo documento Omie |
| `numero_documento_fiscal` | VARCHAR(20) | Número da NF |
| `chave_nfe` | VARCHAR(44) | Chave da NF-e |
| `numero_parcela_omie` | VARCHAR(7) | Parcela formato Omie (001/003) |
| `codigo_barras_ficha_compensacao` | VARCHAR(70) | Código de barras do boleto |
| `codigo_cmc7_cheque` | VARCHAR(40) | Código CMC7 do cheque |
| `id_origem` | VARCHAR(4) | Código da origem |
| `operacao` | VARCHAR(2) | Código da operação |
| `status_titulo` | VARCHAR(100) | Status Omie do título |
| **Impostos retidos** | | |
| `valor_pis` | NUMERIC(15,2) | Valor PIS |
| `retem_pis` | BOOLEAN | Reter PIS |
| `valor_cofins` | NUMERIC(15,2) | Valor COFINS |
| `retem_cofins` | BOOLEAN | Reter COFINS |
| `valor_csll` | NUMERIC(15,2) | Valor CSLL |
| `retem_csll` | BOOLEAN | Reter CSLL |
| `valor_ir` | NUMERIC(15,2) | Valor IR |
| `retem_ir` | BOOLEAN | Reter IR |
| `valor_iss` | NUMERIC(15,2) | Valor ISS |
| `retem_iss` | BOOLEAN | Reter ISS |
| `valor_inss` | NUMERIC(15,2) | Valor INSS |
| `retem_inss` | BOOLEAN | Reter INSS |
| **Boleto** | | |
| `boleto_gerado` | BOOLEAN | Gerou boleto |
| `boleto_data_emissao` | DATE | Data emissão boleto |
| `boleto_numero` | VARCHAR(30) | Número do boleto |
| `boleto_numero_bancario` | VARCHAR(30) | Número bancário do boleto |
| `boleto_per_juros` | NUMERIC(5,2) | % juros boleto |
| `boleto_per_multa` | NUMERIC(5,2) | % multa boleto |
| **Rateios** | | |
| `rateio_categorias` | JSONB | Rateio por categorias |
| `rateio_departamentos` | JSONB | Distribuição por departamentos |
| **Controle** | | |
| `bloquear_baixa` | BOOLEAN | Bloquear baixa |
| `bloquear_exclusao` | BOOLEAN | Bloquear exclusão |
| `importado_api` | BOOLEAN | Importado pela API |
| `baixar_documento` | BOOLEAN | Baixa automática |
| `conciliar_documento` | BOOLEAN | Conciliação automática |
| `tipo_agrupamento` | VARCHAR(1) | Tipo de agrupamento |
| `nsu` | VARCHAR(100) | NSU — comprovante |
| **Pedido/OS** | | |
| `n_cod_pedido` | BIGINT | ID do pedido de venda |
| `n_cod_os` | BIGINT | ID da ordem de serviço |
| `c_pedido_cliente` | VARCHAR(30) | Número pedido do cliente |
| `c_numero_contrato` | VARCHAR(20) | Número do contrato |
| **Repetição** | | |
| `repeticao` | JSONB | Config de repetição (mensal/semanal/específico) |
| `aprendizado_rateio` | BOOLEAN | Aprendizado de rateio |

Unique index: `(empresa_id, codigo_lancamento_integracao)`.

## 2. Novas rotas Omie-style na Edge Function

Adicionar à `contas-receber-api/index.ts` **sem alterar rotas existentes**:

| Método | Rota | Equivalente Omie |
|---|---|---|
| GET | `/consultar` | ConsultarContaReceber |
| GET | `/listar` | ListarContasReceber |
| POST | `/incluir` | IncluirContaReceber |
| PUT | `/alterar` | AlterarContaReceber |
| DELETE | `/excluir` | ExcluirContaReceber |
| POST | `/upsert` | UpsertContaReceber |
| POST | `/upsert-lote` | UpsertContaReceberPorLote / IncluirContaReceberPorLote |
| POST | `/lancar-recebimento` | LancarRecebimento |
| POST | `/cancelar-recebimento` | CancelarRecebimento |
| POST | `/conciliar` | ConciliarRecebimento |
| POST | `/desconciliar` | DesconciliarRecebimento |
| POST | `/cancelar` | CancelarContaReceber |

Respostas seguem o padrão Omie com `codigo_status`/`descricao_status`.

## 3. Documentação

Novo `docs/API_CONTAS_RECEBER.md` com todos os endpoints, tipos, exemplos e filtros.

## 4. API Tester & Portal

Adicionar presets no `ApiTester.tsx` e seção no `ApiDocumentation.tsx`.

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — expandir `contas_receber` com ~50 campos |
| `supabase/functions/contas-receber-api/index.ts` | Editar — adicionar ~12 rotas Omie-style |
| `docs/API_CONTAS_RECEBER.md` | Criar — documentação completa |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — adicionar seção |

