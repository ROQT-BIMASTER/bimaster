# API REST - Integração ERP BiMaster/Union CRM

> **Versão:** 3.0  
> **Data:** Janeiro 2025  
> **Classificação:** Confidencial - Uso Interno

---

## Índice

1. [Visão Geral e Arquitetura](#1-visão-geral-e-arquitetura)
2. [Autenticação e Segurança](#2-autenticação-e-segurança)
3. [Requisitos Técnicos](#3-requisitos-técnicos)
4. [Endpoints - Contas a Receber](#4-endpoints---contas-a-receber)
5. [Endpoints - Contas a Pagar](#5-endpoints---contas-a-pagar)
6. [Endpoints - Estoque](#6-endpoints---estoque)
7. [Estrutura de Dados (Payloads)](#7-estrutura-de-dados-payloads)
8. [Códigos de Resposta HTTP](#8-códigos-de-resposta-http)
9. [Tratamento de Erros](#9-tratamento-de-erros)
10. [Estratégia para Milhões de Registros](#10-estratégia-para-milhões-de-registros)
11. [Queries SQL de Referência](#11-queries-sql-de-referência)
12. [Configuração N8N](#12-configuração-n8n)
13. [Monitoramento e Logs](#13-monitoramento-e-logs)
14. [Checklist de Implementação](#14-checklist-de-implementação)

---

## 1. Visão Geral e Arquitetura

Esta API REST foi projetada para sincronização bidirecional de dados entre sistemas ERP e a plataforma BiMaster/Union CRM, com capacidade para processar **milhões de registros** de forma eficiente e segura.

### Arquitetura da Integração

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────────────┐
│   ERP       │──────│    N8N      │──────│   API REST (Supabase)   │
│ (SQL Server)│ SQL  │ (Orquestrador) HTTP │   Edge Functions        │
└─────────────┘      └─────────────┘      └─────────────────────────┘
                                                   │
                                           ┌───────┴───────┐
                                           │   PostgreSQL  │
                                           │   (Database)  │
                                           └───────────────┘
```

### Características Técnicas

| Característica | Especificação |
|----------------|---------------|
| Protocolo | HTTPS (TLS 1.2+) - Obrigatório em produção |
| Formato de dados | JSON (UTF-8) |
| Autenticação | API Key via header `x-api-key` |
| Rate Limit | 100 requisições/minuto por IP |
| Timeout máximo | 60 segundos por requisição |
| Payload máximo | 100.000 registros por requisição |
| Sincronização concorrente | 1 por entidade (proteção contra deadlocks) |

### Capacidade de Processamento

| Volume | Tempo Estimado | Throughput |
|--------|----------------|------------|
| 10.000 registros | ~5 segundos | ~2.000 rec/seg |
| 100.000 registros | ~50 segundos | ~2.000 rec/seg |
| 500.000 registros | ~4 minutos | ~2.000 rec/seg |
| 1.000.000 registros | ~8 minutos | ~2.000 rec/seg |
| 5.000.000+ registros | ~40 minutos | ~2.000 rec/seg |

---

## 2. Autenticação e Segurança

### Headers Obrigatórios

| Header | Valor | Obrigatório |
|--------|-------|-------------|
| `x-api-key` | [Chave API fornecida] | **Sim** |
| `Content-Type` | `application/json` | **Sim** (POST/PUT) |
| `Accept` | `application/json` | Recomendado |

### Exemplo de Requisição

```bash
curl -X POST "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync-chunk" \
  -H "x-api-key: sua_api_key_aqui" \
  -H "Content-Type: application/json" \
  -d '{"contas": [...], "chunk_id": 1, "total_chunks": 10}'
```

### Boas Práticas de Segurança

- ✅ Armazene a API Key em variáveis de ambiente, NUNCA no código-fonte
- ✅ Utilize HTTPS em todas as requisições
- ✅ Implemente IP Whitelist quando possível
- ✅ Rotacione a API Key periodicamente (recomendado: a cada 90 dias)
- ✅ Monitore logs de acesso para detectar uso anômalo

---

## 3. Requisitos Técnicos

### Ambiente do ERP

- SQL Server 2016+ (recomendado 2019+)
- Usuário de leitura com acesso às tabelas/views necessárias
- Conexão de rede estável (latência < 100ms recomendada)
- Firewall liberado para saída HTTPS (porta 443)

### N8N (Recomendado para Orquestração)

- Versão: 1.0+
- Memória: 4GB+ para cargas massivas
- Timeout do workflow: 30 minutos
- Self-hosted ou N8N Cloud

### Formatos de Dados

- **Datas:** ISO 8601 (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ss.sssZ`)
- **Valores monetários:** Decimal com ponto (`1500.50`)
- **Encoding:** UTF-8

---

## 4. Endpoints - Contas a Receber

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1`

### 4.1 Verificação de Conectividade

```http
GET /n8n-contas-receber/status
```

**Resposta (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "total_registros": 1234567,
  "ultima_sincronizacao": "2025-01-05T08:00:00.000Z"
}
```

### 4.2 Saúde do Sistema

```http
GET /n8n-contas-receber/health
```

**Resposta (200 OK):**
```json
{
  "database": true,
  "sync_active": false,
  "last_sync": "2025-01-05T08:00:00.000Z",
  "response_time_ms": 45
}
```

### 4.3 Iniciar Sessão de Sincronização

```http
POST /n8n-contas-receber/sync-start
```

> ⚠️ **IMPORTANTE:** Apenas 1 sincronização ativa por vez é permitida.

**Request Body:**
```json
{
  "batchSize": 5000,
  "anoMinimo": 2023,
  "scope": "incremental"
}
```

**Resposta (200 OK):**
```json
{
  "sync_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2025-01-05T10:30:00.000Z",
  "message": "Sincronização iniciada com sucesso"
}
```

### 4.4 Enviar Página de Registros

```http
POST /n8n-contas-receber/sync-page
```

**Request Body:**
```json
{
  "sync_id": "550e8400-e29b-41d4-a716-446655440000",
  "page": 1,
  "contas": [
    { /* registro 1 */ },
    { /* registro 2 */ }
  ]
}
```

**Resposta (200 OK):**
```json
{
  "processed": 5000,
  "inserted": 4500,
  "updated": 500,
  "errors": 0,
  "page": 1,
  "duration_ms": 2500
}
```

### 4.5 Finalizar Sincronização

```http
POST /n8n-contas-receber/sync-finish
```

**Request Body:**
```json
{
  "sync_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 4.6 ⭐ Sincronização em Chunks (RECOMENDADO PARA N8N)

```http
POST /contas-receber-api/sync-chunk
```

Endpoint **OTIMIZADO** para processamento de chunks via N8N. Ideal para volumes de 100.000 a 5.000.000+ registros.

**Request Body:**
```json
{
  "contas": [ /* array de 5.000 a 25.000 registros */ ],
  "chunk_id": 1,
  "total_chunks": 20,
  "sync_id": "uuid-opcional",
  "empresa_id": 1
}
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "chunk_id": 1,
  "total_chunks": 20,
  "statistics": {
    "received": 5000,
    "processed": 5000,
    "errors": 0,
    "rate_per_second": 2500
  },
  "duration_ms": 2000,
  "next_action": "continue",
  "message": "Chunk 1 OK. Aguarde 3s antes do próximo chunk."
}
```

### 4.7 Carga Massiva (Bulk)

```http
POST /contas-receber-api/bulk-sync
```

Carga massiva para até 100.000 registros por requisição. Usa SQL bulk insert para máxima performance.

**Request Body:**
```json
{
  "contas": [ /* array de até 100.000 registros */ ],
  "clearExisting": false
}
```

### 4.8 Sincronização Incremental

```http
POST /contas-receber-api/sync-incremental
```

Sincroniza apenas registros alterados (comparação por hash). **OTIMIZADO** para atualizações diárias.

**Request Body:**
```json
{
  "contas": [ /* array de registros */ ],
  "skip_unchanged": true
}
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "mode": "incremental",
  "statistics": {
    "total_received": 10000,
    "processed": 500,
    "inserted": 100,
    "updated": 400,
    "skipped": 9500,
    "errors": 0
  },
  "message": "500 processados, 9500 sem alteração"
}
```

### 4.9 Consultar Progresso

```http
GET /contas-receber-api/chunks-progress?hours=24
```

### 4.10 Status da Sincronização

```http
GET /contas-receber-api/sync-status
```

---

## 5. Endpoints - Contas a Pagar

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-api`

### 5.1 Sincronização

```http
POST /sync
```

**Request Body:**
```json
{
  "contas": [
    {
      "ID Empresa": 1,
      "Empresa": "NOME EMPRESA",
      "Tipo Documento": "NF",
      "Conta": "123456",
      "Parcela": 1,
      "Documento": "NF-001",
      "Fornecedor Codigo": "F001",
      "Fornecedor": "NOME FORNECEDOR",
      "Portador": "CAIXA",
      "Data Emissão": "2025-01-01",
      "Data Vencimento": "2025-02-01",
      "Data Pagamento": null,
      "Valor Original": 2500.00,
      "Valor Desconto": 0.00,
      "Valor Juros": 0.00,
      "Valor Ajustes": 0.00,
      "Valor Pago": 0.00,
      "Valor Aberto": 2500.00,
      "Status": "aberto"
    }
  ]
}
```

### 5.2 Consulta

```http
GET /?limit=100&status=aberto
```

---

## 6. Endpoints - Estoque

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/estoque-n8n-sync`

### 6.1 Sincronização Completa

```http
POST /
```

**Request Body:**
```json
{
  "tipo": "completo",
  "dados": {
    "distribuidoras": [
      {
        "nome": "DISTRIBUIDORA EXEMPLO",
        "cnpj": "12.345.678/0001-90",
        "endereco": "Rua Exemplo, 123",
        "cidade": "São Paulo",
        "uf": "SP",
        "telefone": "(11) 1234-5678",
        "email": "contato@distribuidora.com"
      }
    ],
    "produtos_master": [
      {
        "nome": "PRODUTO EXEMPLO",
        "sku_master": "SKU-001",
        "unidade_medida": "UN",
        "categoria": "CATEGORIA A",
        "subcategoria": "SUB 1",
        "descricao": "Descrição do produto"
      }
    ],
    "vinculacoes": [
      {
        "sku_master": "SKU-001",
        "cnpj_distribuidora": "12.345.678/0001-90",
        "codigo_produto_distribuidora": "PROD-DIST-001",
        "nome_exibicao": "Produto na Distribuidora",
        "fator_conversao": 1.0
      }
    ],
    "movimentacoes": [
      {
        "cnpj_distribuidora": "12.345.678/0001-90",
        "codigo_produto": "PROD-DIST-001",
        "tipo_movimento": "entrada",
        "quantidade": 100,
        "lote": "LOTE-2025-001",
        "localizacao": "A1-B2",
        "data_validade": "2026-01-01",
        "custo_unitario": 15.50,
        "documento_referencia": "NF-12345",
        "observacao": "Entrada de mercadoria"
      }
    ]
  }
}
```

### Tipos de Movimento

| Tipo | Descrição |
|------|-----------|
| `entrada` | Entrada de mercadoria (compra, devolução) |
| `saida` | Saída de mercadoria (venda, transferência) |
| `transferencia` | Movimentação entre localizações |
| `ajuste` | Ajuste de estoque (pode ser positivo ou negativo) |
| `inventario` | Contagem física (define quantidade absoluta) |

---

## 7. Estrutura de Dados (Payloads)

### 7.1 Contas a Receber - Formato Principal

```json
{
  "ID Empresa": 1,
  "Empresa": "NOME EMPRESA LTDA",
  "Tipo": "DUP",
  "Conta": "000001",
  "Parcela": 1,
  "Documento": "NF-12345",
  "Cliente Codigo": "C00001",
  "Cliente": "CLIENTE EXEMPLO S.A.",
  "Portador ID": "001",
  "Portador": "BANCO DO BRASIL",
  "Data Emissão": "2025-01-01",
  "Data Vencimento": "2025-02-01",
  "Data Recebimento": null,
  "Valor Original": 1500.00,
  "Valor Desconto": 0.00,
  "Valor Juros": 0.00,
  "Valor Ajustes": 0.00,
  "Valor Recebido": 0.00,
  "Valor Aberto": 1500.00,
  "Status": "aberto",
  "Vendedor Codigo": "V001",
  "Vendedor": "NOME DO VENDEDOR",
  "Tabela": "TABELA01"
}
```

### 7.2 Contas a Receber - Formato Alternativo (snake_case)

```json
{
  "erp_id": "1-DUP-000001-1-C00001",
  "empresa_id": 1,
  "empresa_nome": "NOME EMPRESA LTDA",
  "tipo_documento": "DUP",
  "numero_documento": "NF-12345",
  "conta": "000001",
  "parcela": 1,
  "cliente_codigo": "C00001",
  "cliente_nome": "CLIENTE EXEMPLO S.A.",
  "portador_id": "001",
  "portador_nome": "BANCO DO BRASIL",
  "data_emissao": "2025-01-01",
  "data_vencimento": "2025-02-01",
  "data_recebimento": null,
  "valor_original": 1500.00,
  "valor_desconto": 0.00,
  "valor_juros": 0.00,
  "valor_ajustes": 0.00,
  "valor_recebido": 0.00,
  "valor_aberto": 1500.00,
  "status": "aberto",
  "vendedor_codigo": "V001",
  "vendedor_nome": "NOME DO VENDEDOR",
  "tabela_preco": "TABELA01"
}
```

### 7.3 Contas a Pagar

```json
{
  "ID Empresa": 1,
  "Empresa": "NOME EMPRESA LTDA",
  "Tipo Documento": "NF",
  "Conta": "000001",
  "Parcela": 1,
  "Documento": "NF-FORN-12345",
  "Fornecedor Codigo": "F00001",
  "Fornecedor": "FORNECEDOR EXEMPLO LTDA",
  "Portador": "CAIXA GERAL",
  "Data Emissão": "2025-01-01",
  "Data Vencimento": "2025-02-01",
  "Data Pagamento": null,
  "Valor Original": 2500.00,
  "Valor Desconto": 0.00,
  "Valor Juros": 0.00,
  "Valor Ajustes": 0.00,
  "Valor Pago": 0.00,
  "Valor Aberto": 2500.00,
  "Status": "aberto",
  "ID Historico": "001",
  "Historico": "DESPESAS OPERACIONAIS"
}
```

---

## 8. Códigos de Resposta HTTP

| Código | Significado | Ação Recomendada |
|--------|-------------|------------------|
| 200 | Sucesso | Processar resposta normalmente |
| 207 | Sucesso Parcial | Verificar campo "errors" na resposta |
| 400 | Requisição Inválida | Verificar formato do payload |
| 401 | Não Autorizado | Verificar header x-api-key |
| 404 | Endpoint não encontrado | Verificar URL |
| 409 | Conflito (sync em andamento) | Aguardar sync atual finalizar |
| 413 | Payload muito grande | Reduzir tamanho do chunk |
| 429 | Rate limit excedido | Aguardar e retry (ver Retry-After) |
| 500 | Erro interno do servidor | Retry com backoff exponencial |
| 503 | Serviço indisponível | Retry após alguns segundos |

---

## 9. Tratamento de Erros

### Estrutura de Erro Padrão

```json
{
  "error": "Descrição legível do erro",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "cliente_codigo",
    "message": "Campo obrigatório"
  },
  "request_id": "uuid"
}
```

### Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| `VALIDATION_ERROR` | Dados inválidos no payload |
| `AUTH_ERROR` | Falha de autenticação |
| `RATE_LIMIT` | Limite de requisições excedido |
| `SYNC_CONFLICT` | Sincronização já em andamento |
| `PAYLOAD_TOO_LARGE` | Payload excede limite máximo |
| `DATABASE_ERROR` | Erro de banco de dados |
| `TIMEOUT` | Timeout na operação |

### Estratégia de Retry (Exponential Backoff)

| Tentativa | Aguardar |
|-----------|----------|
| 1ª | 1 segundo |
| 2ª | 2 segundos |
| 3ª | 4 segundos |
| 4ª | 8 segundos |
| 5ª | 16 segundos |

**Exemplo JavaScript:**
```javascript
async function fetchWithRetry(url, options, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
    const delay = Math.pow(2, attempt - 1) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

---

## 10. Estratégia para Milhões de Registros

### Parâmetros Otimizados

| Parâmetro | Valor Recomendado |
|-----------|-------------------|
| Chunk Size (carga inicial) | 25.000 registros |
| Chunk Size (sync diário) | 10.000 registros |
| Chunk Size (rede instável) | 5.000 registros |
| Intervalo entre chunks | 3.000 ms (3 segundos) |
| Timeout por requisição | 60.000 ms (60 segundos) |
| Retries | 5 tentativas com backoff |
| Sincronizações simultâneas | Máximo 1 por entidade |

### Fluxo Recomendado

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 1. Contar   │────▶│ 2. Dividir  │────▶│ 3. Enviar   │────▶│ 4. Finalizar│
│   registros │     │   em chunks │     │   chunks    │     │   sync      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Exemplo de Cálculo

- Total de registros: 1.000.000
- Chunk size: 25.000
- Total de chunks: 40
- Tempo por chunk: ~12 segundos (10s processamento + 3s delay)
- **Tempo total estimado: 40 × 12s = 480 segundos = 8 minutos**

### Schedule Recomendado

| Tipo | Horário/Frequência |
|------|-------------------|
| Full Sync (carga inicial) | 1x única - Noturno (02:00 - 05:00) |
| Full Sync (semanal) | Domingos às 03:00 |
| Incremental (diário) | 4x ao dia: 06:00, 12:00, 18:00, 23:00 |
| Incremental (tempo real) | A cada 15 minutos |

---

## 11. Queries SQL de Referência

### Contas a Receber (SQL Server)

```sql
DECLARE @pageSize INT = 25000;
DECLARE @pageNumber INT = 1;
DECLARE @offset INT = (@pageNumber - 1) * @pageSize;
DECLARE @dataInicio DATE = '2024-01-01';

SELECT 
  emp.ID_EMPRESA AS [ID Empresa],
  emp.NOME AS [Empresa],
  cr.TIPO AS [Tipo],
  cr.CONTA AS [Conta],
  cr.PARCELA AS [Parcela],
  cr.DOCUMENTO AS [Documento],
  cli.CODIGO AS [Cliente Codigo],
  cli.NOME AS [Cliente],
  port.ID AS [Portador ID],
  port.NOME AS [Portador],
  FORMAT(cr.DATA_EMISSAO, 'yyyy-MM-dd') AS [Data Emissão],
  FORMAT(cr.DATA_VENCIMENTO, 'yyyy-MM-dd') AS [Data Vencimento],
  FORMAT(cr.DATA_RECEBIMENTO, 'yyyy-MM-dd') AS [Data Recebimento],
  CAST(cr.VALOR_ORIGINAL AS DECIMAL(18,2)) AS [Valor Original],
  CAST(ISNULL(cr.VALOR_DESCONTO, 0) AS DECIMAL(18,2)) AS [Valor Desconto],
  CAST(ISNULL(cr.VALOR_JUROS, 0) AS DECIMAL(18,2)) AS [Valor Juros],
  CAST(ISNULL(cr.VALOR_AJUSTES, 0) AS DECIMAL(18,2)) AS [Valor Ajustes],
  CAST(ISNULL(cr.VALOR_RECEBIDO, 0) AS DECIMAL(18,2)) AS [Valor Recebido],
  CAST(cr.VALOR_ABERTO AS DECIMAL(18,2)) AS [Valor Aberto],
  CASE 
    WHEN cr.DATA_RECEBIMENTO IS NOT NULL AND cr.VALOR_ABERTO = 0 THEN 'pago'
    WHEN cr.DATA_VENCIMENTO < GETDATE() AND cr.VALOR_ABERTO > 0 THEN 'vencido'
    WHEN cr.VALOR_RECEBIDO > 0 AND cr.VALOR_ABERTO > 0 THEN 'parcial'
    ELSE 'aberto'
  END AS [Status],
  vend.CODIGO AS [Vendedor Codigo],
  vend.NOME AS [Vendedor],
  tab.NOME AS [Tabela]
FROM CONTAS_RECEBER cr WITH (NOLOCK)
  INNER JOIN EMPRESAS emp WITH (NOLOCK) ON cr.EMPRESA_ID = emp.ID
  INNER JOIN CLIENTES cli WITH (NOLOCK) ON cr.CLIENTE_ID = cli.ID
  LEFT JOIN PORTADORES port WITH (NOLOCK) ON cr.PORTADOR_ID = port.ID
  LEFT JOIN VENDEDORES vend WITH (NOLOCK) ON cr.VENDEDOR_ID = vend.ID
  LEFT JOIN TABELAS_PRECO tab WITH (NOLOCK) ON cr.TABELA_ID = tab.ID
WHERE cr.DATA_EMISSAO >= @dataInicio
ORDER BY emp.ID_EMPRESA, cr.CONTA, cr.PARCELA
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

### Contas a Pagar (SQL Server)

```sql
DECLARE @pageSize INT = 25000;
DECLARE @pageNumber INT = 1;
DECLARE @offset INT = (@pageNumber - 1) * @pageSize;
DECLARE @dataInicio DATE = '2024-01-01';

SELECT 
  emp.ID_EMPRESA AS [ID Empresa],
  emp.NOME AS [Empresa],
  cp.TIPO_DOCUMENTO AS [Tipo Documento],
  cp.CONTA AS [Conta],
  cp.PARCELA AS [Parcela],
  cp.DOCUMENTO AS [Documento],
  forn.CODIGO AS [Fornecedor Codigo],
  forn.NOME AS [Fornecedor],
  port.NOME AS [Portador],
  FORMAT(cp.DATA_EMISSAO, 'yyyy-MM-dd') AS [Data Emissão],
  FORMAT(cp.DATA_VENCIMENTO, 'yyyy-MM-dd') AS [Data Vencimento],
  FORMAT(cp.DATA_PAGAMENTO, 'yyyy-MM-dd') AS [Data Pagamento],
  CAST(cp.VALOR_ORIGINAL AS DECIMAL(18,2)) AS [Valor Original],
  CAST(ISNULL(cp.VALOR_DESCONTO, 0) AS DECIMAL(18,2)) AS [Valor Desconto],
  CAST(ISNULL(cp.VALOR_JUROS, 0) AS DECIMAL(18,2)) AS [Valor Juros],
  CAST(ISNULL(cp.VALOR_AJUSTES, 0) AS DECIMAL(18,2)) AS [Valor Ajustes],
  CAST(ISNULL(cp.VALOR_PAGO, 0) AS DECIMAL(18,2)) AS [Valor Pago],
  CAST(cp.VALOR_ABERTO AS DECIMAL(18,2)) AS [Valor Aberto],
  CASE 
    WHEN cp.DATA_PAGAMENTO IS NOT NULL AND cp.VALOR_ABERTO = 0 THEN 'pago'
    WHEN cp.DATA_VENCIMENTO < GETDATE() AND cp.VALOR_ABERTO > 0 THEN 'vencido'
    WHEN cp.VALOR_PAGO > 0 AND cp.VALOR_ABERTO > 0 THEN 'parcial'
    ELSE 'aberto'
  END AS [Status],
  hist.CODIGO AS [ID Historico],
  hist.NOME AS [Historico]
FROM CONTAS_PAGAR cp WITH (NOLOCK)
  INNER JOIN EMPRESAS emp WITH (NOLOCK) ON cp.EMPRESA_ID = emp.ID
  INNER JOIN FORNECEDORES forn WITH (NOLOCK) ON cp.FORNECEDOR_ID = forn.ID
  LEFT JOIN PORTADORES port WITH (NOLOCK) ON cp.PORTADOR_ID = port.ID
  LEFT JOIN HISTORICOS hist WITH (NOLOCK) ON cp.HISTORICO_ID = hist.ID
WHERE cp.DATA_EMISSAO >= @dataInicio
ORDER BY emp.ID_EMPRESA, cp.CONTA, cp.PARCELA
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

### Contagem Total

```sql
-- Contas a Receber
SELECT COUNT(*) AS total_registros
FROM CONTAS_RECEBER WITH (NOLOCK)
WHERE DATA_EMISSAO >= '2024-01-01';

-- Contas a Pagar
SELECT COUNT(*) AS total_registros
FROM CONTAS_PAGAR WITH (NOLOCK)
WHERE DATA_EMISSAO >= '2024-01-01';
```

---

## 12. Configuração N8N

### HTTP Request Node

```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync-chunk",
  "authentication": "none",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      { "name": "x-api-key", "value": "={{$env.N8N_API_KEY}}" },
      { "name": "Content-Type", "value": "application/json" }
    ]
  },
  "options": {
    "timeout": 60000
  },
  "retry": {
    "enabled": true,
    "maxTries": 5,
    "waitBetweenTries": 3000
  }
}
```

### SQL Server Node

```json
{
  "operation": "executeQuery",
  "options": {
    "connectionTimeout": 60000,
    "requestTimeout": 120000
  }
}
```

### Workflow Recomendado

```
[1. Schedule Trigger]
        │
        ▼
[2. SQL: Count Total]
        │
        ▼
[3. Set: Calcular Chunks]
        │
        ▼
[4. Loop: Para cada Chunk]
        │
        ▼
[5. SQL: Buscar Página]
        │
        ▼
[6. HTTP: POST /sync-chunk]
        │
        ▼
[7. Wait: 3 segundos]
        │
        ▼
[8. IF: Último chunk?] ──Yes──▶ [9. HTTP: POST /sync-complete]
        │
       No
        │
        └─────────────────▶ Próximo chunk
```

---

## 13. Monitoramento e Logs

### Endpoints de Monitoramento

- `GET /contas-receber-api/sync-status` - Status da última sincronização
- `GET /contas-receber-api/chunks-progress?hours=24` - Progresso dos chunks
- `GET /contas-receber-api/stats` - Histórico das últimas 10 sincronizações

### Logs Registrados

- Início e fim de cada sincronização
- Progresso de cada chunk
- Erros detalhados com stack trace
- Métricas de performance (registros/segundo)
- IP de origem das requisições

**Retenção de Logs:** 90 dias

---

## 14. Checklist de Implementação

### Antes de Iniciar

- [ ] Obter API Key de produção
- [ ] Definir IP(s) de origem para whitelist
- [ ] Validar acesso ao SQL Server (usuário somente leitura)
- [ ] Estimar volume de registros por entidade
- [ ] Definir horários de sincronização

### Desenvolvimento

- [ ] Testar endpoint /status (verificar conectividade)
- [ ] Testar endpoint /health (verificar saúde do sistema)
- [ ] Implementar query SQL com paginação
- [ ] Testar com 100 registros primeiro
- [ ] Testar com 1.000 registros
- [ ] Testar com 10.000 registros
- [ ] Implementar tratamento de erros e retries
- [ ] Implementar logs locais

### Homologação

- [ ] Executar carga completa em ambiente de teste
- [ ] Validar dados sincronizados
- [ ] Medir performance (registros/segundo)
- [ ] Testar recuperação de falhas
- [ ] Documentar tempos de execução

### Produção

- [ ] Configurar schedule de sincronização
- [ ] Configurar alertas de erro
- [ ] Monitorar primeiras execuções
- [ ] Validar integridade dos dados

---

## Suporte Técnico

### Informações para Abertura de Chamado

Ao reportar problemas, incluir:
- Request ID (campo `request_id` na resposta de erro)
- Timestamp exato da requisição
- Endpoint utilizado
- Payload enviado (sem dados sensíveis)
- Resposta recebida
- Volume de dados sendo processado

### Documentação Adicional

- `docs/N8N_SYNC_CONFIGURATION.md`
- `docs/N8N_WORKFLOW_1M_REGISTROS.md`

---

> **Versão 3.0** | Janeiro 2025  
> Este documento é confidencial e de uso exclusivo para integração.
