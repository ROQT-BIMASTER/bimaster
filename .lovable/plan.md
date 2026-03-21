

# Padronização Contas a Pagar — Modelo Omie

## Resumo

A API `contas-pagar-api` já possui a maioria das rotas equivalentes ao Omie, mas falta padronizar nomenclatura, adicionar rotas Omie-style (consultar, incluir, alterar, excluir, upsert, upsert-lote, lancar-pagamento, cancelar-pagamento), expandir a tabela com campos tributários/CNAB do Omie, e alinhar respostas ao padrão `codigo_status`/`descricao_status`.

## 1. Expansão da tabela `contas_pagar`

Campos faltantes do modelo Omie que precisam ser adicionados:

| Campo | Tipo | Descrição |
|---|---|---|
| `codigo_lancamento_omie` | BIGINT | Código do lançamento no Omie |
| `codigo_lancamento_integracao` | VARCHAR(60) | Código de integração (substituir/complementar `codigo_integracao`) |
| `codigo_cliente_fornecedor` | BIGINT | Código do fornecedor no Omie |
| `codigo_cliente_fornecedor_integracao` | VARCHAR(60) | Código integração do fornecedor |
| `data_previsao` | DATE | Data de previsão de pagamento |
| `data_entrada` | DATE | Data de registro/entrada |
| `numero_parcela_omie` | VARCHAR(7) | Número da parcela (formato Omie) |
| `total_parcelas_omie` | INTEGER | Total de parcelas |
| `codigo_projeto` | INTEGER | Código do projeto |
| `codigo_vendedor` | INTEGER | Código do vendedor |
| `numero_pedido` | VARCHAR(15) | Número do pedido |
| `codigo_tipo_documento` | VARCHAR(5) | Código tipo documento Omie |
| `chave_nfe` | VARCHAR(44) | Chave da NF-e |
| `numero_documento_fiscal` | VARCHAR(20) | Número da NF |
| `id_conta_corrente` | BIGINT | Conta corrente vinculada (Omie) |
| `id_origem` | VARCHAR(4) | Código de origem |
| `operacao` | VARCHAR(2) | Código da operação |
| `status_titulo` | VARCHAR(3) | Status Omie do título |
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
| **CNAB/Bancário** | | |
| `codigo_barras_ficha_compensacao` | VARCHAR(70) | Código de barras do boleto |
| `cnab_dados` | JSONB | Dados CNAB (forma_pagamento, banco_transferencia, pix_qrcode, etc.) |
| **Rateios** | | |
| `rateio_categorias` | JSONB | Array de rateio por categorias |
| `rateio_departamentos` | JSONB | Array de rateio por departamentos |
| **Serviço Tomado** | | |
| `servico_tomado` | JSONB | Dados do serviço tomado (NF, CST, alíquotas) |
| **Pagamento embutido** | | |
| `codigo_baixa_integracao` | VARCHAR(20) | Código de integração da baixa |
| `bloquear_exclusao` | BOOLEAN | Bloquear exclusão |
| `bloqueado` | BOOLEAN | Bloqueado pela API |
| `baixar_documento` | BOOLEAN | Baixa automática |
| `conciliar_documento` | BOOLEAN | Conciliação automática |

Unique index: `(empresa_id, codigo_lancamento_integracao)` para upsert Omie-style.

## 2. Novas rotas na Edge Function `contas-pagar-api`

Adicionar rotas padrão Omie **sem alterar as rotas existentes** (puramente aditivo):

| Método | Rota | Descrição | Equivalente Omie |
|---|---|---|---|
| GET | `/consultar` | Consultar por ID ou código integração | ConsultarContaPagar |
| POST | `/incluir` | Incluir título | IncluirContaPagar |
| PUT | `/alterar` | Alterar título | AlterarContaPagar |
| DELETE | `/excluir` | Excluir (inativar) título | ExcluirContaPagar |
| POST | `/upsert` | Upsert unitário | UpsertContaPagar |
| POST | `/upsert-lote` | Upsert em lote | UpsertContaPagarPorLote / IncluirContaPagarPorLote |
| POST | `/lancar-pagamento` | Baixa via API (formato Omie) | LancarPagamento |
| POST | `/cancelar-pagamento` | Cancelar baixa | CancelarPagamento |
| GET | `/listar` | Listagem paginada (formato Omie) | ListarContasPagar |

As rotas existentes (`/sync`, `/bulk-sync`, `/query`, `/update`, `/cancelar`, `/registrar-pagamento`, `/estornar`, etc.) permanecem intactas.

Formato de resposta Omie-style para as novas rotas:
```json
{
  "codigo_lancamento_omie": 123,
  "codigo_lancamento_integracao": "INT-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!"
}
```

Listagem Omie-style:
```json
{
  "pagina": 1,
  "total_de_paginas": 5,
  "registros": 20,
  "total_de_registros": 100,
  "conta_pagar_cadastro": [...]
}
```

## 3. Documentação

Atualizar `docs/API_CONTAS_PAGAR.md` com as novas rotas Omie-style, mantendo documentação das rotas existentes.

## 4. API Tester & Portal

Adicionar presets no `ApiTester.tsx` para as novas rotas:
- Consultar Conta a Pagar
- Incluir Conta a Pagar
- Alterar Conta a Pagar
- Upsert Conta a Pagar
- Upsert por Lote
- Lançar Pagamento (Omie)
- Cancelar Pagamento (Omie)
- Listar (Omie)

Atualizar `ApiDocumentation.tsx` com a referência completa.

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — expandir `contas_pagar` com ~30 campos |
| `supabase/functions/contas-pagar-api/index.ts` | Editar — adicionar ~9 rotas Omie-style |
| `docs/API_CONTAS_PAGAR.md` | Editar — adicionar novas rotas |
| `src/components/erp/ApiTester.tsx` | Editar — adicionar presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — atualizar seção Contas a Pagar |

