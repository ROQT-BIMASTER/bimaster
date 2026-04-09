

# Correcao: Logging de Auditoria nas APIs com Auth Proprio

## Diagnostico

A `contas-pagar-api` (e possivelmente outras APIs ERP) **nao usa** `validateAnyAuth` do `_shared/auth.ts`. Ela possui funcoes internas proprias:
- `validateApiKey()` (linha 500-530) — valida x-api-key diretamente contra `erp_config` e `erp_api_keys`
- `validateAuth()` (linha 533-546) — tenta API key primeiro, depois JWT

Como `logApiAccess` so e chamado dentro de `validateAnyAuth`, essas APIs nunca registram logs na tabela `api_security_log`. O token funciona (retorna 200), mas a auditoria registra "Nenhuma autenticacao" porque a funcao de logging nunca e executada.

O endpoint `/status` tambem nao exige autenticacao nenhuma (linha 551) — retorna dados sem verificar token. Isso explica por que mesmo com token valido, o log mostra falha.

## Solucao

### 1. Adicionar `logApiAccess` nas funcoes internas da `contas-pagar-api`

Importar `logApiAccess` (ja importado mas nao usado) e chamar dentro de:
- `validateApiKey()` — ao validar com sucesso, registrar com `apiKeyUsed: true, success: true`
- `validateAuth()` — ao validar JWT com sucesso, registrar com `apiKeyUsed: false, success: true`
- Nos blocos de `Unauthorized` — registrar com `success: false`

### 2. Proteger endpoint `/status` com autenticacao

O endpoint `/status` (linha 551) retorna informacoes internas (config, rate limiting, slots ativos) sem exigir token. Adicionar `validateAuth()` antes de retornar, para que chamadas sem token sejam rejeitadas.

### 3. Auditar outras APIs ERP com auth proprio

Verificar e corrigir as seguintes APIs que tambem usam `validateErpAuth` em vez de `validateAnyAuth`:
- `contas-receber-api`
- `clientes-api`
- `erp-plano-contas-api`
- `erp-fornecedores-query`
- `categorias-api`
- `departamentos-api`
- `empresas-api`
- `centros-custo-api`

Para essas, adicionar chamadas de `logApiAccess` dentro de `validateErpAuth` no `_shared/auth.ts`, cobrindo 100% das APIs ERP sem editar cada uma individualmente.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/_shared/auth.ts`
- Dentro de `validateErpAuth()`, adicionar `logApiAccess` no retorno bem-sucedido e no throw de erro
- Cobertura automatica para todas as 8+ APIs que usam essa funcao

### Arquivo: `supabase/functions/contas-pagar-api/index.ts`
- Na funcao interna `validateApiKey()`: chamar `logApiAccess` ao validar com sucesso
- Na funcao interna `validateAuth()`: chamar `logApiAccess` ao validar JWT
- Nos blocos de `Unauthorized` (linhas 696, 862, 935, 974, 1023, 1057, 1158, 1181): chamar `logApiAccess` com `success: false`
- No endpoint `/status`: adicionar `validateAuth()` antes de retornar

### Resultado esperado
Apos a correcao, toda chamada autenticada via token aparecera na aba "Auditoria" com status "Sucesso", key_preview do token usado, endpoint, IP e metodo HTTP.

| Componente | Arquivo | Tipo |
|-----------|---------|------|
| Logging em `validateErpAuth` | `_shared/auth.ts` | Edicao |
| Logging em auth interno | `contas-pagar-api/index.ts` | Edicao |
| Protecao do `/status` | `contas-pagar-api/index.ts` | Edicao |

