

# Auditoria de Segurança — Preparação para 100%

## Resultado: 3 Falhas Críticas Encontradas

### Verificação HTTP/HTTPS: APROVADO
Todas as chamadas `fetch()` em edge functions usam **HTTPS**. A única ocorrência de `http://` é uma referência XML namespace no `tailwind.config.ts` (inofensiva). Nenhuma API chama endpoints HTTP em texto claro.

---

## Falha 1: ~40 Edge Functions sem `verify_jwt` no config.toml (CRÍTICO)

O `config.toml` lista ~65 funções, mas existem **~140 funções** no diretório. Funções ausentes incluem APIs críticas:

| Funções faltantes (amostra) | Risco |
|---|---|
| `api-sandbox` | Alto — sandbox sem config explícito |
| `boletos-api`, `contas-correntes-api`, `lancamentos-cc-api` | Alto — APIs financeiras |
| `clientes-api`, `webhook-subscriptions-api`, `projetos-api` | Alto — dados sensíveis |
| `categorias-api`, `bancos-api`, `cidades-api`, `paises-api`, `origens-api` | Médio — dados de referência |
| `anexos-api`, `parcelas-api`, `movimentos-financeiros-api` | Alto — dados financeiros |
| `trade-marketing-api`, `estoque-api`, `vendas-union-api` | Médio |
| + ~20 outras funções | Variado |

**Correção**: Adicionar TODAS as funções faltantes ao `config.toml` com o `verify_jwt` correto (false para APIs que fazem auth própria via x-api-key, true para as que dependem de JWT).

### Falha 2: `analyze-brand-website` sem proteção SSRF (MÉDIO)

A função faz `fetch(website_url)` com URL fornecida pelo usuário mas **não usa `validateExternalUrl()`**. Um atacante pode forçar o servidor a acessar IPs internos.

**Correção**: Adicionar import de `validateExternalUrl` e chamar antes do fetch.

### Falha 3: SSRF Guard permite protocolo `http:` (BAIXO)

O `ssrf-guard.ts` linha 57 permite `http:` além de `https:`. Para auditoria, devemos forçar apenas HTTPS.

**Correção**: Remover `http:` da whitelist de protocolos permitidos.

---

## Plano de Implementação

### 1. config.toml — Registrar todas as funções faltantes

Adicionar ~40 entradas com `verify_jwt` correto baseado na lógica interna de cada função:
- `verify_jwt = false` para funções que validam auth internamente (APIs ERP com x-api-key, webhooks)
- `verify_jwt = true` para funções que dependem do JWT do Supabase

### 2. analyze-brand-website — SSRF Guard

Adicionar `validateExternalUrl(website_url)` antes do `fetch`.

### 3. ssrf-guard.ts — Forçar HTTPS only

Alterar condição para permitir apenas `https:`.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/config.toml` | Adicionar ~40 funções faltantes |
| `supabase/functions/analyze-brand-website/index.ts` | Adicionar SSRF guard |
| `supabase/functions/_shared/ssrf-guard.ts` | Forçar HTTPS only |

