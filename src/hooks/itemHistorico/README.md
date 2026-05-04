# `@/hooks/itemHistorico`

Barrel oficial dos hooks do **Histórico de Item de Aprovação** (Kanban de Aprovações).
Sempre importe a partir deste módulo — nunca direto do arquivo `useItemHistorico.ts`.

## Padrão de importação

```ts
import {
  useItemHistorico,
  useComentarItem,
  HISTORICO_PAGE_SIZE,
  type HistoricoEntry,
  type HistoricoFilters,
} from "@/hooks/itemHistorico";
```

Não use:

```ts
// ❌ Caminho interno — não importe assim
import { useItemHistorico } from "@/hooks/useItemHistorico";
```

## API

| Export | Tipo | Descrição |
|---|---|---|
| `useItemHistorico(itemId, filters?)` | hook | `useInfiniteQuery` paginado (30/página) com filtros por ação, intervalo de datas e ordem (`asc`/`desc`). |
| `useComentarItem()` | hook | Mutation que chama a RPC `rpc_comentar_item_aprovacao` e invalida o cache do histórico. |
| `HISTORICO_PAGE_SIZE` | const | Tamanho da página (30). |
| `HistoricoEntry` | tipo | Entrada da timeline (movimentação, delegação, oficialização, comentário). |
| `HistoricoFilters` | tipo | `{ acao?, dataDe?, dataAte?, ordem? }`. |

## Exemplo: listar histórico com infinite scroll

```tsx
import { useItemHistorico } from "@/hooks/itemHistorico";

function Timeline({ itemId }: { itemId: string }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useItemHistorico(itemId, { ordem: "desc" });

  if (isLoading) return <p>Carregando…</p>;

  const entries = data?.pages.flat() ?? [];

  return (
    <ul>
      {entries.map((e) => (
        <li key={e.id}>
          {e.acao} — {e.user_nome ?? "Sistema"}
        </li>
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </button>
      )}
    </ul>
  );
}
```

## Exemplo: adicionar comentário

```tsx
import { useComentarItem } from "@/hooks/itemHistorico";
import { toast } from "sonner";

function ComentarioForm({ itemId }: { itemId: string }) {
  const comentar = useComentarItem();

  return (
    <button
      onClick={() =>
        comentar.mutate(
          { itemId, comentario: "Aprovado com ressalvas" },
          {
            onSuccess: () => toast.success("Comentário registrado"),
            onError: (err) => toast.error(err.message),
          },
        )
      }
      disabled={comentar.isPending}
    >
      Comentar
    </button>
  );
}
```

## Filtros

```ts
useItemHistorico(itemId, {
  acao: "delegacao",         // ou "todos"
  dataDe: "2026-01-01",      // YYYY-MM-DD (timezone America/Sao_Paulo)
  dataAte: "2026-12-31",
  ordem: "desc",             // "desc" (recente primeiro) | "asc"
});
```

## Convenções

- O hook resolve `user_nome` em batch via `profiles` para os `user_id` da página.
- Após `useComentarItem`, o cache de `["item-historico", itemId]` é invalidado automaticamente.
- Cada página retorna no máximo `HISTORICO_PAGE_SIZE` (30) entradas; `getNextPageParam` para quando vier menos.
