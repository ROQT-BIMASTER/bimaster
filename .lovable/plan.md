

# Corrigir Bug — Subordinados não carregando no "Adicionar da Equipe"

## Problema
A RPC `get_subordinados` retorna objetos com campo `subordinado_id`, mas o código no dialog usa `s.id` (que é `undefined`). Resultado: a lista de IDs fica vazia, nenhum perfil é buscado, e o dialog mostra "Todos já estão no projeto".

## Correção

### `src/components/projetos/ProjetoMembrosDialog.tsx` — linha 70

Trocar:
```ts
const ids = (data || []).map((s: any) => s.id);
```
Por:
```ts
const ids = (data || []).map((s: any) => s.subordinado_id);
```

Uma linha. Nenhuma outra alteração necessária.

