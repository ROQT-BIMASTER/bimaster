

# Para nota 10/10 — Gaps restantes

## Nota Atual: 9/10

O portal já tem: Getting Started, fluxo de integração, convenção POST, paginação, catálogo de webhooks, auth, rate limits, error codes, flow diagrams, request/response examples, Excel export, chat de suporte.

## O que falta

### 1. Curl copiável por endpoint (impacto alto)
O dev do ERP quer copiar um curl e testar no terminal. Hoje precisa montar manualmente. Adicionar botão "Copiar curl" em cada endpoint expandido, gerando automaticamente o comando com headers, body e URL.

### 2. Guia de verificação HMAC para webhooks (impacto alto)
O ERP vai receber webhooks do BiMaster e precisa saber como verificar a assinatura `x-hub-signature-256`. Falta um snippet mostrando como validar HMAC-SHA256 em Node.js/Python.

### 3. Informação de ambiente (impacto médio)
Falta indicar claramente que a URL base é produção e se existe sandbox. Adicionar badge "Produção" ao lado da base URL e nota sobre ambiente de testes.

### 4. Guia de retry/backoff (impacto médio)
Quando o ERP recebe 429 ou 5xx, precisa saber a estratégia de retry. Documentar: backoff exponencial, header `Retry-After`, máx 3 tentativas.

### 5. Changelog / Release Notes (impacto baixo)
Seção com histórico de mudanças na API para que o ERP saiba quando novos endpoints foram adicionados.

## Plano de Ação

### Arquivo: `src/components/erp/ApiDocumentation.tsx`

1. **Curl generator** — No componente `ApiSectionBlock`, ao expandir um endpoint, adicionar botão "Copiar curl" que monta `curl -X METHOD -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" -d 'BODY' URL`

2. **Seção HMAC no Getting Started** — Adicionar card com snippet de verificação de assinatura webhook em Node.js e Python (3-5 linhas cada)

3. **Badge de ambiente** — Adicionar `Badge` "Produção" ao lado da base URL e nota "Para testes, use o ApiTester acima"

4. **Nota de retry** — Adicionar card no Getting Started sobre estratégia de retry (backoff exponencial, Retry-After header)

5. **Sidebar: link "Changelog"** — Seção simples com 3-4 entradas (datas das versões recentes)

### Arquivo: `src/components/erp/ApiTester.tsx`
Sem alterações.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Curl generator, HMAC guide, ambiente, retry, changelog |

## Resultado Esperado
- Dev copia curl → testa em 10 segundos
- Sabe verificar webhooks com HMAC
- Entende retry strategy sem perguntar
- Nota: **10/10**

