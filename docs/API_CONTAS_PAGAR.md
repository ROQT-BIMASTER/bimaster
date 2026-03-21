# API Contas a Pagar — Documentação Completa

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-api`

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Rotas Omie-Style (NOVO)

### GET /consultar — Consultar título

```
GET /contas-pagar-api/consultar?codigo_lancamento_integracao=INT-001
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | UUID | ID interno |
| `codigo_lancamento_integracao` | string | Código de integração |
| `codigo_lancamento_omie` | integer | Código numérico Omie |

### POST /incluir — Incluir título (IncluirContaPagar)

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "2.04.01",
  "data_previsao": "21/03/2026",
  "id_conta_corrente": 4243124
}
```

**Resposta:**
```json
{
  "codigo_lancamento_omie": null,
  "codigo_lancamento_integracao": "INT-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!"
}
```

### PUT /alterar — Alterar título (AlterarContaPagar)

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "valor_documento": 150,
  "data_vencimento": "30/04/2026"
}
```

### DELETE /excluir — Excluir título (ExcluirContaPagar)

```
DELETE /contas-pagar-api/excluir?codigo_lancamento_integracao=INT-001
```

### POST /upsert — Upsert unitário (UpsertContaPagar)

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "empresa_id": 8,
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "2.04.01"
}
```

### POST /upsert-lote — Upsert em lote (UpsertContaPagarPorLote)

```json
{
  "lote": 1,
  "conta_pagar_cadastro": [
    { "codigo_lancamento_integracao": "INT-001", "empresa_id": 8, "valor_documento": 100 }
  ]
}
```

Máximo: **500 registros por lote**.

### POST /lancar-pagamento — Baixa (LancarPagamento)

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "valor": 100.20,
  "desconto": 0,
  "juros": 0,
  "multa": 0,
  "data": "21/03/2026",
  "observacao": "Baixa via API"
}
```

**Resposta:**
```json
{
  "codigo_lancamento_integracao": "INT-001",
  "codigo_baixa": "uuid",
  "liquidado": "S",
  "valor_baixado": 100.20,
  "codigo_status": "0",
  "descricao_status": "Pagamento registrado com sucesso!"
}
```

### POST /cancelar-pagamento — Cancelar baixa (CancelarPagamento)

```json
{ "codigo_baixa": "uuid-pagamento" }
```

### GET /listar — Listagem paginada (ListarContasPagar)

```
GET /contas-pagar-api/listar?pagina=1&registros_por_pagina=20&filtrar_por_status=pendente
```

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `pagina` | integer | 1 | Número da página |
| `registros_por_pagina` | integer | 20 | Registros por página (máx 500) |
| `apenas_importado_api` | string | — | Filtrar importados (S/N) |
| `filtrar_por_status` | string | — | Status (vírgula para múltiplos) |
| `filtrar_por_data_de` | date | — | Vencimento a partir de |
| `filtrar_por_data_ate` | date | — | Vencimento até |
| `filtrar_conta_corrente` | integer | — | Código da conta corrente |
| `filtrar_cliente` | integer | — | Código do fornecedor |
| `filtrar_por_projeto` | integer | — | Código do projeto |
| `filtrar_por_vendedor` | integer | — | Código do vendedor |
| `ordenar_por` | string | data_vencimento | Campo de ordenação |
| `ordem_descrescente` | string | — | S para decrescente |
| `exibir_obs` | string | N | Exibir observações (S/N) |

**Resposta:**
```json
{
  "pagina": 1,
  "total_de_paginas": 5,
  "registros": 20,
  "total_de_registros": 100,
  "conta_pagar_cadastro": [...]
}
```

---

## Endpoints Legados (Sync & CRUD)

### Endpoints de Sync (ERP → BiMaster)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sync` | Sync legado (compatibilidade N8N) |
| POST | `/bulk-sync` | Sync em massa com rate limiting |
| POST | `/sync-incremental` | Sync incremental com hash |
| POST | `/sync-complete` | Finalizar sync multi-chunk |
| POST | `/trigger-n8n` | Disparar sync via webhook N8N |

### Endpoints de Consulta

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Listar últimos 100 títulos |
| GET | `/query` | Consulta avançada com filtros |
| GET | `/status` | Status da API |
| GET | `/stats` | Estatísticas de sync |
| GET | `/last-sync` | Última data de sync |
| GET | `/parcelas` | Parcelas de um título |
| GET | `/pagamentos` | Histórico de pagamentos |
| GET | `/anexos` | Comprovantes de um título |

### Endpoints de Escrita

| Método | Rota | Descrição |
|--------|------|-----------|
| PUT | `/update` | Atualizar título |
| POST | `/cancelar` | Cancelar título(s) |
| POST | `/registrar-pagamento` | Registrar baixa |
| POST | `/estornar` | Estornar pagamento |
| POST | `/parcelas/sync` | Sync parcelas do ERP |
| POST | `/anexos` | Registrar comprovante |

---

## Campos Tributários (Impostos Retidos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `valor_pis` | decimal | Valor do PIS |
| `retem_pis` | boolean | Reter PIS |
| `valor_cofins` | decimal | Valor do COFINS |
| `retem_cofins` | boolean | Reter COFINS |
| `valor_csll` | decimal | Valor CSLL |
| `retem_csll` | boolean | Reter CSLL |
| `valor_ir` | decimal | Valor IR |
| `retem_ir` | boolean | Reter IR |
| `valor_iss` | decimal | Valor ISS |
| `retem_iss` | boolean | Reter ISS |
| `valor_inss` | decimal | Valor INSS |
| `retem_inss` | boolean | Reter INSS |

## Campos CNAB / Bancário

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `codigo_barras_ficha_compensacao` | string(70) | Código de barras do boleto |
| `cnab_dados` | JSONB | Dados CNAB (forma_pagamento, banco_transferencia, pix_qrcode) |

## Rateios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rateio_categorias` | JSONB | Array de rateio por categorias |
| `rateio_departamentos` | JSONB | Array de rateio por departamentos |
| `servico_tomado` | JSONB | Dados do serviço tomado (NF, CST, alíquotas) |

---

## Mapa Completo de Rotas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | JWT/Key | Listar últimos 100 títulos |
| GET | `/query` | JWT/Key | Consulta avançada com filtros |
| GET | `/consultar` | JWT/Key | Consultar por ID/código integração (Omie) |
| GET | `/listar` | JWT/Key | Listagem paginada Omie-style |
| GET | `/status` | Key | Status da API |
| GET | `/stats` | JWT/Key | Estatísticas de sync |
| GET | `/last-sync` | Key | Última data de sync |
| GET | `/parcelas` | JWT/Key | Parcelas de um título |
| GET | `/pagamentos` | JWT/Key | Histórico de pagamentos |
| GET | `/anexos` | JWT/Key | Comprovantes de um título |
| POST | `/sync` | Key | Sync legado |
| POST | `/bulk-sync` | Key | Sync em massa |
| POST | `/sync-incremental` | Key | Sync incremental |
| POST | `/sync-complete` | Key | Finalizar sync |
| POST | `/trigger-n8n` | JWT/Key | Disparar N8N |
| POST | `/incluir` | JWT/Key | Incluir título (Omie) |
| POST | `/upsert` | JWT/Key | Upsert unitário (Omie) |
| POST | `/upsert-lote` | JWT/Key | Upsert em lote (Omie) |
| POST | `/lancar-pagamento` | JWT/Key | Baixa Omie-style |
| POST | `/cancelar-pagamento` | JWT/Key | Cancelar baixa (Omie) |
| POST | `/registrar-pagamento` | JWT/Key | Registrar baixa |
| POST | `/cancelar` | JWT/Key | Cancelar título |
| POST | `/estornar` | JWT/Key | Estornar pagamento |
| POST | `/parcelas/sync` | Key | Sync parcelas |
| POST | `/anexos` | JWT/Key | Registrar comprovante |
| PUT | `/update` | JWT/Key | Atualizar título |
| PUT | `/alterar` | JWT/Key | Alterar título (Omie) |
| DELETE | `/excluir` | JWT/Key | Excluir título (Omie) |
