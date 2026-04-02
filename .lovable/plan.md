

# Fix: Tarefas Não Carregando do Asana — `codigoAcom is not defined`

## Causa Raiz

O log de sincronização mostra o erro **`codigoAcom is not defined`** para todos os 3 projetos. Na linha 234 do `asana-sync/index.ts`, o código referencia uma variável `codigoAcom` que **nunca foi declarada**. Isso causa um crash JavaScript que impede a inserção de **todas** as tarefas.

Resultado: 3 projetos criados, 38 seções sincronizadas, **0 tarefas**, 0 comentários, 0 anexos.

## Correção

Uma única linha no edge function:

**`supabase/functions/asana-sync/index.ts`**, linha 234:
```
// DE:
codigo_acom: codigoAcom,

// PARA:
codigo_acom: cfMap.get("acom") || null,
```

Isso extrai o valor do campo customizado "ACOM" que já está mapeado no `cfMap` (linha 203-207).

## Resultado Esperado

Após o redeploy, ao rodar a sincronização novamente, todas as tarefas, comentários, anexos, tags e dependências serão importados corretamente.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/asana-sync/index.ts` | Fix linha 234: `codigoAcom` → `cfMap.get("acom") || null` |

