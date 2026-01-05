# 📋 Documentação Técnica de Integração - API REST

**Sistema:** BiMaster/Union CRM  
**Versão:** 2.0  
**Data:** Janeiro 2025  
**Responsável:** Time de Desenvolvimento Lovable

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [URLs Base](#urls-base)
4. [Endpoints de Contas a Receber](#endpoints-de-contas-a-receber)
5. [Endpoints de Contas a Pagar](#endpoints-de-contas-a-pagar)
6. [Endpoints de Estoque](#endpoints-de-estoque)
7. [Mapeamento de Campos](#mapeamento-de-campos)
8. [Exemplos de Requisições](#exemplos-de-requisições)
9. [Tratamento de Erros](#tratamento-de-erros)
10. [Recomendações de Performance](#recomendações-de-performance)
11. [Monitoramento e Logs](#monitoramento-e-logs)

---

## 🔍 Visão Geral

Esta API REST permite a sincronização bidirecional de dados entre o sistema ERP e a plataforma BiMaster/Union CRM. A integração é realizada via chamadas HTTP REST com autenticação por API Key.

### Capacidades
- **Contas a Receber:** Sincronização de títulos, vencimentos, pagamentos
- **Contas a Pagar:** Sincronização de despesas, fornecedores, vencimentos
- **Estoque:** Movimentações, saldos, produtos por distribuidora

### Características Técnicas
- Protocolo: HTTPS
- Formato: JSON
- Autenticação: API Key via header `x-api-key`
- Rate Limit: 100 requisições/minuto
- Timeout: 60 segundos por requisição
- Tamanho máximo de payload: 100.000 registros

---

## 🔐 Autenticação

Todas as requisições devem incluir o header de autenticação:

```http
x-api-key: {N8N_API_KEY}
Content-Type: application/json
```

### Obtenção da API Key
A API Key será fornecida pelo administrador do sistema BiMaster. Mantenha-a em segurança e não a exponha em código-fonte público.

### Headers Obrigatórios

| Header | Valor | Descrição |
|--------|-------|-----------|
| `x-api-key` | `{API_KEY}` | Chave de autenticação obrigatória |
| `Content-Type` | `application/json` | Tipo de conteúdo da requisição |

---

## 🌐 URLs Base

### Produção
```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/
```

### Endpoints Disponíveis

| Entidade | Endpoint Base |
|----------|---------------|
| Contas a Receber (Sync) | `/n8n-contas-receber` |
| Contas a Receber (API) | `/contas-receber-api` |
| Contas a Pagar | `/contas-pagar-api` |
| Estoque | `/estoque-n8n-sync` |

---

## 💰 Endpoints de Contas a Receber

### 1. Status da Conexão
Verifica a conectividade e retorna estatísticas do sistema.

```http
GET /n8n-contas-receber/status
x-api-key: {API_KEY}
```

**Resposta:**
```json
{
  "success": true,
  "n8n": { "connected": true },
  "local": {
    "totalRecords": 150000,
    "lastSync": "2025-01-05T10:30:00Z"
  },
  "database": { "healthy": true, "responseTime": 45 }
}
```

---

### 2. Health Check
Verifica a saúde do sistema e retorna configurações ativas.

```http
GET /n8n-contas-receber/health
x-api-key: {API_KEY}
```

**Resposta:**
```json
{
  "success": true,
  "database": { "healthy": true, "responseTime": 50 },
  "activeSyncs": 0,
  "maxConcurrentSyncs": 1,
  "rateLimiting": {
    "maxRequestsPerMinute": 100,
    "pageDelayMs": 1000
  },
  "config": {
    "batchSize": 100,
    "maxBatchSize": 100,
    "upsertBatchSize": 100
  }
}
```

---

### 3. Iniciar Sincronização
Inicia uma nova sessão de sincronização. **IMPORTANTE:** Apenas 1 sync por vez é permitida.

```http
POST /n8n-contas-receber/sync-start
x-api-key: {API_KEY}
Content-Type: application/json

{
  "batchSize": 100,
  "anoMinimo": 2024,
  "scope": "full"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `batchSize` | number | Não | Registros por página (máx: 100) |
| `anoMinimo` | number | Não | Filtrar registros a partir deste ano |
| `scope` | string | Não | `full`, `2025`, `2024+` |

**Resposta:**
```json
{
  "success": true,
  "syncId": "abc123-def456",
  "batchSize": 100,
  "nextOffset": 0,
  "message": "Sync session started"
}
```

---

### 4. Sincronizar Página
Processa uma página de registros durante a sincronização.

```http
POST /n8n-contas-receber/sync-page
x-api-key: {API_KEY}
Content-Type: application/json

{
  "batchSize": 100,
  "offset": 0,
  "syncId": "abc123-def456"
}
```

**Resposta:**
```json
{
  "success": true,
  "processed": 100,
  "hasMore": true,
  "nextOffset": 100,
  "statistics": {
    "inserted": 50,
    "updated": 50,
    "errors": 0
  }
}
```

---

### 5. Finalizar Sincronização

```http
POST /n8n-contas-receber/sync-finish
x-api-key: {API_KEY}
Content-Type: application/json

{
  "syncId": "abc123-def456",
  "totalProcessed": 15000
}
```

---

### 6. Sincronização em Bulk (Carga Massiva)
Para cargas de grande volume (até 100.000 registros).

```http
POST /contas-receber-api/bulk-sync
x-api-key: {API_KEY}
Content-Type: application/json

{
  "contas": [
    { ... registro 1 ... },
    { ... registro 2 ... }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "mode": "bulk_sql",
  "statistics": {
    "total": 10000,
    "processed": 10000,
    "errors": 0,
    "rate_per_second": 2500
  },
  "duration_ms": 4000
}
```

---

### 7. Sincronização em Chunks (Recomendado para N8N)

```http
POST /contas-receber-api/sync-chunk
x-api-key: {API_KEY}
Content-Type: application/json

{
  "contas": [ ... ],
  "chunk_id": 1,
  "total_chunks": 30,
  "sync_id": "abc123",
  "empresa_id": 1
}
```

**Resposta:**
```json
{
  "success": true,
  "chunk_id": 1,
  "total_chunks": 30,
  "statistics": {
    "received": 5000,
    "processed": 5000,
    "errors": 0,
    "rate_per_second": 1200
  },
  "next_action": "continue",
  "message": "Chunk 1 OK. Aguarde 3s antes do próximo chunk."
}
```

---

## 📤 Endpoints de Contas a Pagar

### 1. Sincronizar Contas a Pagar

```http
POST /contas-pagar-api/sync
x-api-key: {API_KEY}
Content-Type: application/json

{
  "contas": [
    {
      "erp_id": "1-NF-12345-1",
      "empresa_id": 1,
      "fornecedor_codigo": "F001",
      "fornecedor_nome": "Fornecedor Exemplo",
      "tipo_documento": "NF",
      "numero_documento": "12345",
      "parcela": 1,
      "valor_original": 1500.00,
      "valor_aberto": 1500.00,
      "data_emissao": "2025-01-01",
      "data_vencimento": "2025-02-01",
      "status": "aberto"
    }
  ]
}
```

---

### 2. Consultar Contas a Pagar

```http
GET /contas-pagar-api?page=1&limit=100
x-api-key: {API_KEY}
```

---

## 📦 Endpoints de Estoque

### 1. Sincronização Completa

```http
POST /estoque-n8n-sync
x-api-key: {API_KEY}
Content-Type: application/json

{
  "tipo": "completo",
  "dados": {
    "distribuidoras": [
      {
        "nome": "Distribuidora ABC",
        "cnpj": "12.345.678/0001-99",
        "endereco": "Rua Exemplo, 123",
        "cidade": "São Paulo",
        "uf": "SP"
      }
    ],
    "produtos_master": [
      {
        "nome": "Produto Exemplo",
        "sku_master": "SKU001",
        "unidade_medida": "UN",
        "categoria": "Alimentos"
      }
    ],
    "vinculacoes": [
      {
        "sku_master": "SKU001",
        "cnpj_distribuidora": "12345678000199",
        "codigo_produto_distribuidora": "PROD-001",
        "fator_conversao": 1.0
      }
    ],
    "movimentacoes": [
      {
        "cnpj_distribuidora": "12345678000199",
        "codigo_produto": "PROD-001",
        "tipo_movimento": "entrada",
        "quantidade": 100,
        "lote": "LOTE001",
        "custo_unitario": 10.50
      }
    ]
  },
  "transaction_id": "TXN-001"
}
```

**Tipos de Movimentação:**
| Tipo | Descrição |
|------|-----------|
| `entrada` | Entrada de mercadoria |
| `saida` | Saída de mercadoria |
| `transferencia` | Transferência entre locais |
| `ajuste` | Ajuste de inventário (positivo ou negativo) |
| `inventario` | Contagem de inventário (substitui quantidade) |

---

## 🗺️ Mapeamento de Campos

### Contas a Receber

| Campo ERP | Campo Local | Tipo | Obrigatório |
|-----------|-------------|------|-------------|
| `ID Empresa` | `empresa_id` | integer | Sim |
| `Empresa` | `empresa_nome` | string | Não |
| `Tipo` | `tipo_documento` | string | Sim |
| `Nota` | `numero_documento` | string | Sim |
| `Seq` | `parcela` | integer | Sim |
| `Código` | `cliente_codigo` | string | Sim |
| `Cliente` | `cliente_nome` | string | Não |
| `Valor_Trc` | `valor_original` | decimal | Sim |
| `Valor em Aberto` | `valor_aberto` | decimal | Sim |
| `Valor Pago` | `valor_recebido` | decimal | Não |
| `Valor Juros` | `valor_juros` | decimal | Não |
| `Valor Desconto` | `valor_desconto` | decimal | Não |
| `Emissão` | `data_emissao` | date (ISO 8601) | Não |
| `Vencimento` | `data_vencimento` | date (ISO 8601) | Sim |
| `Data Pgto` | `data_recebimento` | date (ISO 8601) | Não |
| `ID Portador` | `portador_id` | string | Não |
| `Nome Portador` | `portador` | string | Não |
| `Vendedor` | `vendedor_nome` | string | Não |
| `Tabela` | `tabela_preco` | string | Não |
| `Conta` | `conta` | string | Não |

### Formato Alternativo (Já Transformado)

Você pode enviar os dados já no formato transformado usando os nomes de campo locais:

```json
{
  "erp_id": "1-NF-12345-1",
  "empresa_id": 1,
  "tipo_documento": "NF",
  "numero_documento": "12345",
  "parcela": 1,
  "cliente_codigo": "C001",
  "cliente_nome": "Cliente Exemplo",
  "valor_original": 1000.00,
  "valor_aberto": 500.00,
  "valor_pago": 500.00,
  "data_vencimento": "2025-02-01T00:00:00Z"
}
```

---

## 📝 Exemplos de Requisições

### Exemplo cURL - Status

```bash
curl -X GET \
  'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/status' \
  -H 'x-api-key: SUA_API_KEY' \
  -H 'Content-Type: application/json'
```

### Exemplo cURL - Sync Bulk

```bash
curl -X POST \
  'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/bulk-sync' \
  -H 'x-api-key: SUA_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "contas": [
      {
        "ID Empresa": 1,
        "Tipo": "NF",
        "Nota": "12345",
        "Seq": 1,
        "Código": "C001",
        "Cliente": "Cliente Teste",
        "Valor_Trc": 1000.00,
        "Valor em Aberto": 1000.00,
        "Vencimento": "2025-02-01"
      }
    ]
  }'
```

### Exemplo N8N - Workflow Completo

```javascript
// Configuração do HTTP Request no N8N

// 1. Headers
{
  "x-api-key": "{{ $env.N8N_API_KEY }}",
  "Content-Type": "application/json"
}

// 2. Body (para sync-chunk)
{
  "contas": {{ JSON.stringify($input.all()) }},
  "chunk_id": {{ $runIndex + 1 }},
  "total_chunks": {{ $node["Split In Batches"].context.noItemsLeft ? $runIndex + 1 : null }},
  "empresa_id": 1
}
```

---

## ❌ Tratamento de Erros

### Códigos de Status HTTP

| Código | Descrição | Ação Recomendada |
|--------|-----------|------------------|
| `200` | Sucesso | - |
| `207` | Sucesso parcial (alguns erros) | Verificar campo `errors` na resposta |
| `400` | Requisição inválida | Verificar formato do JSON |
| `401` | Não autorizado | Verificar API Key |
| `413` | Payload muito grande | Reduzir para máx 100.000 registros |
| `429` | Rate limit excedido | Aguardar `Retry-After` segundos |
| `500` | Erro interno | Tentar novamente com retry exponencial |

### Estrutura de Erro

```json
{
  "error": "Descrição do erro",
  "hint": "Sugestão de correção",
  "details": { ... }
}
```

### Retry Exponencial Recomendado

```javascript
const delays = [1000, 2000, 4000, 8000, 16000]; // ms
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (response.status < 500) throw new Error('Client error');
  } catch (e) {
    await sleep(delays[attempt]);
  }
}
```

---

## ⚡ Recomendações de Performance

### Configurações Ótimas para Grandes Volumes

| Parâmetro | Valor Recomendado | Descrição |
|-----------|-------------------|-----------|
| Chunk Size | 5.000 a 10.000 | Registros por requisição |
| Delay entre chunks | 3.000 ms | Evita sobrecarga |
| Syncs simultâneos | 1 | Apenas 1 sync por vez |
| Timeout | 60.000 ms | Timeout por requisição |

### Estimativas de Tempo

| Volume | Tempo Estimado |
|--------|----------------|
| 10.000 registros | ~30 segundos |
| 100.000 registros | ~5 minutos |
| 500.000 registros | ~25 minutos |
| 1.000.000 registros | ~50 minutos |

### Dicas de Otimização

1. **Use filtro de ano:** Sincronize apenas dados relevantes (ex: 2024+)
2. **Sincronize em horários de baixo uso:** Prefira noites ou fins de semana
3. **Monitore o health check:** Verifique `/health` antes de grandes cargas
4. **Implemente retry:** Use backoff exponencial para erros 5xx
5. **Divida por empresa:** Para múltiplas empresas, sincronize uma por vez

---

## 📊 Monitoramento e Logs

### Consultar Progresso de Chunks

```http
GET /contas-receber-api/chunks-progress?hours=24
x-api-key: {API_KEY}
```

**Resposta:**
```json
{
  "data": [
    {
      "chunk_id": 1,
      "registros_processados": 5000,
      "erros": 0,
      "duracao_ms": 4200,
      "status": "success",
      "created_at": "2025-01-05T10:00:00Z"
    }
  ],
  "summary": {
    "total_chunks": 30,
    "total_processed": 150000,
    "total_errors": 0,
    "avg_duration_ms": 4100
  }
}
```

### Consultar Status da Última Sync

```http
GET /contas-receber-api/sync-status?empresa_id=1
x-api-key: {API_KEY}
```

---

## 🔒 Segurança

1. **API Key:** Nunca exponha a API Key em código público
2. **HTTPS:** Todas as requisições devem usar HTTPS
3. **IP Whitelist:** Recomendado configurar whitelist de IPs no N8N
4. **Audit Log:** Todas as sincronizações são registradas com IP de origem

---

## 📞 Suporte

Para dúvidas ou problemas com a integração:

- **Email:** suporte@bimaster.com.br
- **Documentação:** [Link para documentação completa]
- **Status da API:** Verificar endpoint `/health`

---

## 📜 Histórico de Versões

| Versão | Data | Alterações |
|--------|------|------------|
| 2.0 | Janeiro 2025 | Adição de bulk-sync, chunks, rate limiting |
| 1.5 | Dezembro 2024 | Suporte a filtro por ano |
| 1.0 | Novembro 2024 | Versão inicial |

---

*Documento gerado automaticamente. Última atualização: Janeiro 2025*
