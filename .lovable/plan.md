

# Plano: Corrigir autenticação das APIs ERP para suportar `erp_api_keys`

## Problema identificado

Ao testar a chave `huggs-erp-5nf7vewlpf3s9td1fh7vwac9`, todas as 3 APIs retornaram **401 Unauthorized**. A causa raiz:

| Edge Function | Suporta `erp_api_keys`? | Problema |
|---|---|---|
| `erp-fornecedores-query` | Nao | So verifica `erp_config` — sem fallback |
| `erp-portadores-api` | Nao | So verifica `erp_config` — sem fallback |
| `erp-plano-contas-api` | Sim | Fallback existe, mas usa `parseInt(empresa)` que falha com `empresa_id` texto |
| `erp-webhook-inbound` | Sim | Funciona (usa empresa_id como texto) |
| `contas-pagar-export-api` | Sim | Funciona (so verifica autenticacao booleana) |
| `contas-pagar-api` | Nao | So verifica `N8N_API_KEY` — sem fallback |

## Solucao

### 1. Adicionar fallback `erp_api_keys` nas 3 APIs sem suporte

Adicionar o mesmo padrao de fallback em `erp-fornecedores-query`, `erp-portadores-api` e `contas-pagar-api`:

```typescript
// Fallback: check erp_api_keys table
if (!empresaId) {
  const { validateErpApiKey } = await import("../_shared/erp-key-validator.ts");
  const empresa = await validateErpApiKey(apiKey);
  if (empresa) {
    empresaId = empresa; // manter como string
  }
}
```

### 2. Corrigir `erp-plano-contas-api` — remover `parseInt`

A tabela `erp_api_keys.empresa_id` e tipo `text`, nao `integer`. Remover `parseInt(empresa) || 0` e usar o valor texto diretamente.

### 3. Corrigir tipos de `empresaId` nas queries

Nas APIs de portadores e fornecedores, a query usa `.eq("empresa_id", empresaId)` — precisa funcionar com o tipo correto da coluna no banco. Verificar se as tabelas `portadores` e `fabrica_fornecedores` usam `empresa_id` numerico ou texto e ajustar.

## Arquivos impactados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/erp-fornecedores-query/index.ts` | Adicionar fallback `erp_api_keys` |
| `supabase/functions/erp-portadores-api/index.ts` | Adicionar fallback `erp_api_keys` |
| `supabase/functions/erp-plano-contas-api/index.ts` | Remover `parseInt`, usar texto |
| `supabase/functions/contas-pagar-api/index.ts` | Adicionar fallback `erp_api_keys` no `validateApiKey` e `validateAuth` |

## Resultado esperado

Apos a correcao, a chave `huggs-erp-5nf7vewlpf3s9td1fh7vwac9` funcionara em todas as APIs ERP, e qualquer chave gerada pelo Portal de Integracao sera aceita uniformemente.

