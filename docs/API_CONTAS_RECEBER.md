# API Contas a Receber — Documentação Completa

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api`

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Rotas Integração

### GET /consultar — ConsultarContaReceber

```
GET /contas-receber-api/consultar?codigo_lancamento_integracao=INT-001
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | UUID | ID interno |
| `codigo_lancamento_integracao` | string | Código de integração |
| `codigo_lancamento_huggs` | integer | Código numérico Huggs |

### POST /incluir — IncluirContaReceber

```json
{
  "codigo_lancamento_integracao": "CR-001",
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "1.01.02",
  "data_previsao": "21/03/2026",
  "id_conta_corrente": 4243124
}
```

**Resposta:**
```json
{
  "codigo_lancamento_huggs": null,
  "codigo_lancamento_integracao": "CR-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!"
}
```

### PUT /alterar — AlterarContaReceber

```json
{
  "codigo_lancamento_integracao": "CR-001",
  "valor_documento": 150,
  "data_vencimento": "30/04/2026"
}
```

### DELETE /excluir — ExcluirContaReceber

```
DELETE /contas-receber-api/excluir?codigo_lancamento_integracao=CR-001
```

### POST /upsert — UpsertContaReceber

```json
{
  "codigo_lancamento_integracao": "CR-001",
  "empresa_id": 8,
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "1.01.02"
}
```

### POST /upsert-lote — UpsertContaReceberPorLote

```json
{
  "lote": 1,
  "conta_receber_cadastro": [
    { "codigo_lancamento_integracao": "CR-001", "empresa_id": 8, "valor_documento": 100 }
  ]
}
```

Máximo: **500 registros por lote**.

### POST /lancar-recebimento — LancarRecebimento

```json
{
  "codigo_lancamento_integracao": "CR-001",
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
  "codigo_lancamento_integracao": "CR-001",
  "codigo_baixa": "uuid",
  "liquidado": "S",
  "valor_baixado": 100.20,
  "codigo_status": "0",
  "descricao_status": "Recebimento registrado com sucesso!"
}
```

### POST /cancelar-recebimento — CancelarRecebimento

```json
{ "codigo_baixa": 0 }
```

### POST /conciliar — ConciliarRecebimento

```json
{ "codigo_baixa": 0 }
```

### POST /desconciliar — DesconciliarRecebimento

```json
{ "codigo_baixa": 0 }
```

### POST /cancelar — CancelarContaReceber

```json
{ "chave_lancamento": 0 }
```

### POST /estornar — EstornarContaReceber

Estorna um título (reversão lógica). Diferente de `/cancelar`, registra motivo de auditoria
e marca status como `Estornado`. Não permitido para títulos `Liquidado`, `Cancelado` ou
já `Estornado`.

```json
{
  "nCodTitulo": "uuid-do-titulo",
  "cMotivo": "Devolução solicitada pelo cliente"
}
```

Aceita também `codigo_lancamento_integracao` no lugar de `nCodTitulo`.

**Resposta 200:**
```json
{
  "codigo_lancamento_integracao": "CR-001",
  "nCodTitulo": "uuid",
  "codigo_status": "0",
  "descricao_status": "Título estornado com sucesso!"
}
```

**Códigos de erro:**
| HTTP | codigo_status | Cenário |
|------|---------------|---------|
| 400  | 3             | Título Liquidado / Cancelado / já Estornado |
| 404  | 1             | Título não encontrado |
| 400  | —             | Payload inválido (Zod) |

### GET /listar — ListarContasReceber

```
GET /contas-receber-api/listar?pagina=1&registros_por_pagina=20
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
| `filtrar_cliente` | integer | — | Código do cliente |
| `filtrar_por_projeto` | integer | — | Código do projeto |
| `filtrar_por_vendedor` | integer | — | Código do vendedor |
| `filtrar_por_cpf_cnpj` | string | — | Filtrar por CPF/CNPJ |
| `ordenar_por` | string | data_vencimento | Campo de ordenação |
| `ordem_descrescente` | string | — | S para decrescente |

**Resposta:**
```json
{
  "pagina": 1,
  "total_de_paginas": 5,
  "registros": 20,
  "total_de_registros": 100,
  "conta_receber_cadastro": [...]
}
```

---

## Endpoints Legados (Sync)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sync` | Sync legado (compatibilidade N8N) |
| POST | `/bulk-sync` | Sync em massa |
| POST | `/sync-chunk` | Sync chunk |
| GET | `/sync-status` | Status da sync |
| POST | `/delete-old` | Limpar registros antigos |

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

## Campos Boleto

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `boleto_gerado` | boolean | Gerou boleto |
| `boleto_numero` | string(30) | Número do boleto |
| `boleto_numero_bancario` | string(30) | Número bancário |
| `boleto_per_juros` | decimal | % juros |
| `boleto_per_multa` | decimal | % multa |

## Rateios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rateio_categorias` | JSONB | Rateio por categorias |
| `rateio_departamentos` | JSONB | Distribuição por departamentos |

---

## Mapa Completo de Rotas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | JWT | Listar últimos 100 títulos |
| GET | `/consultar` | JWT/Key | Consultar por ID/código integração (Huggs) |
| GET | `/listar` | JWT/Key | Listagem paginada Integração |
| GET | `/sync-status` | Key | Status da sync |
| POST | `/sync` | Key | Sync legado |
| POST | `/bulk-sync` | Key | Sync em massa |
| POST | `/sync-chunk` | Key | Sync chunk |
| POST | `/incluir` | JWT/Key | Incluir título (Huggs) |
| POST | `/upsert` | JWT/Key | Upsert unitário (Huggs) |
| POST | `/upsert-lote` | JWT/Key | Upsert em lote (Huggs) |
| POST | `/lancar-recebimento` | JWT/Key | Baixa Integração |
| POST | `/cancelar-recebimento` | JWT/Key | Cancelar baixa (Huggs) |
| POST | `/conciliar` | JWT/Key | Conciliar recebimento |
| POST | `/desconciliar` | JWT/Key | Desconciliar recebimento |
| POST | `/cancelar` | JWT/Key | Cancelar título |
| POST | `/estornar` | JWT/Key | Estornar título (reversão lógica com motivo) |
| POST | `/delete-old` | Key | Limpar antigos |
| PUT | `/alterar` | JWT/Key | Alterar título (Huggs) |
| DELETE | `/excluir` | JWT/Key | Excluir título (Huggs) |
