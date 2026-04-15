

# Correcao 3 — Campos Opcionais Marcados como Obrigatorios no API Tester

## Problema

O `REQUIRED_FIELDS` no `ApiTester.tsx` (linha 528) marca `data_previsao` e `id_conta_corrente` como obrigatorios no endpoint CP `/incluir`, contradizendo o OpenAPI schema (linha 1047) e o Zod da Edge Function.

## Alteracoes

**Arquivo: `src/components/erp/ApiTester.tsx`**

### 1. Corrigir REQUIRED_FIELDS (linha 528)

```typescript
// ANTES:
"/contas-pagar-api/incluir": ["codigo_lancamento_integracao", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria", "data_previsao", "id_conta_corrente"],

// DEPOIS:
"/contas-pagar-api/incluir": ["codigo_lancamento_integracao", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
```

### 2. Verificar CR `/upsert` required (linha 533)

CR `/upsert` esta sem `codigo_categoria` nos obrigatorios. O OpenAPI (linha 1101) lista `codigo_categoria` como required. Adicionar.

```typescript
// ANTES:
"/contas-receber-api/upsert": ["codigo_lancamento_integracao", "empresa_id", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento"],

// DEPOIS:
"/contas-receber-api/upsert": ["codigo_lancamento_integracao", "empresa_id", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
```

### 3. Manter default bodies com campos opcionais (linhas 296, 317, 319)

Os default bodies para CP `/incluir`, CR `/incluir` e CR `/upsert` incluem `data_previsao` e `id_conta_corrente` como exemplos — isso esta correto (mostrar campos opcionais no exemplo e bom para o integrador). Nao alterar.

## Resumo

| Local | Antes | Depois |
|---|---|---|
| CP `/incluir` required | 7 campos (2 errados) | 5 campos (correto) |
| CR `/upsert` required | 5 campos (falta categoria) | 6 campos (correto) |
| Default bodies | Mantidos com campos opcionais | Sem alteracao |

