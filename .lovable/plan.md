

# Correcao 7 — Sandbox: Roteamento Quebrado por Sufixo `-api`

## Problema Raiz

O `parseRoute` (linha 281) extrai o primeiro segmento do path como `apiName`. O API Tester envia paths como `/contas-pagar-api/incluir`, resultando em `apiName = "contas-pagar-api"`. Porem o switch (linha 297) faz match em `contas-pagar` — sem o sufixo `-api`. Resultado: todos os endpoints CP/CR caem no `default` e retornam a resposta generica.

O mesmo problema afeta:
- `contas-pagar-api` → deveria casar com `contas-pagar`
- `contas-receber-api` → deveria casar com `contas-receber`
- `contas-correntes-api` → deveria casar com `contas-correntes`
- `lancamentos-cc-api` → deveria casar com `lancamentos-cc`
- `erp-fornecedores-sync` → deveria casar com `fornecedores-sync`
- Outros com sufixo `-api`

## Solucao

**Arquivo: `supabase/functions/api-sandbox/index.ts`**

### Alteracao 1 — Normalizar `apiName` no `parseRoute` (linha 281-286)

Adicionar normalizacao que remove sufixos `-api` e prefixos `erp-` para alinhar com os nomes usados no switch:

```typescript
function parseRoute(path: string): { apiName: string; action: string } {
  const clean = path.replace(/^\/+/, "").replace(/\?.*$/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return { apiName: "unknown", action: "" };
  let apiName = parts[0];
  // Normalize: remove -api suffix and erp- prefix to match mock function names
  apiName = apiName.replace(/-api$/, "");
  apiName = apiName.replace(/^erp-/, "");
  return { apiName, action: parts.slice(1).join("/") || "" };
}
```

### Alteracao 2 — Adicionar cases ausentes no switch (linhas 297-321)

Adicionar aliases para os nomes que usam `contas-pagar-export` (que apos normalizacao vira `contas-pagar-export`):

```typescript
case "contas-pagar-export": mockData = mockExportacao(action, body); break;
```

Tambem garantir que `fornecedores-query` e `fornecedores-sync` continuem funcionando (apos remover prefixo `erp-`, `erp-fornecedores-sync` vira `fornecedores-sync` — ja existe no switch).

### Alteracao 3 — Enriquecer `listar` do CP (linha 26)

Adicionar `data_vencimento` ao mock de listar para alinhar com o formato pedido:

```typescript
case "listar": return { 
  pagina: 1, total_de_paginas: 1, registros: 2, total_de_registros: 2, 
  conta_pagar_cadastro: [{ 
    id: "sandbox-uuid-001", 
    codigo_lancamento_integracao: "[SANDBOX] CP-001", 
    valor_documento: 1500, 
    data_vencimento: "2026-04-15", 
    status: "pendente" 
  }] 
};
```

### Alteracao 4 — Enriquecer `listar` do CR (linha 45)

Mesmo padrao:

```typescript
case "listar": return { 
  pagina: 1, total_de_paginas: 1, registros: 2, total_de_registros: 2, 
  conta_receber_cadastro: [{ 
    id: "sandbox-uuid-001", 
    codigo_lancamento_integracao: "[SANDBOX] CR-001", 
    valor_documento: 1500, 
    data_vencimento: "2026-04-15", 
    status: "pendente" 
  }] 
};
```

## Resumo

- Causa raiz: sufixo `-api` nos paths nao era removido antes do switch
- 1 funcao alterada (`parseRoute`) — resolve todos os endpoints de uma vez
- 1 case adicionado (`contas-pagar-export`)
- 2 mocks enriquecidos (listar CP/CR com `data_vencimento`)
- Deploy da edge function necessario apos alteracao

