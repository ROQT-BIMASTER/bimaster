# Correção do crash "cannot add postgres_changes callbacks after subscribe()"

## Causa raiz

O hook `useInbox` (`src/hooks/useInbox.ts`) cria um canal Realtime com nome fixo:

```ts
.channel("inbox_items_realtime")
```

Esse hook é consumido por mais de um componente ao mesmo tempo (AppSidebar + InboxDrawer). O cliente do Supabase mantém um cache global de canais por nome — quando a segunda instância tenta registrar `.on("postgres_changes", ...)` em um canal que já passou por `.subscribe()`, a biblioteca lança a exceção exibida no print, derrubando a árvore React (ErrorBoundary → "Algo deu errado").

O React StrictMode em dev amplifica o problema (mount/unmount duplo).

## Solução

Tornar o nome do canal único por instância e garantir cleanup robusto:

1. **`src/hooks/useInbox.ts`** — substituir
   ```ts
   .channel("inbox_items_realtime")
   ```
   por um nome único por mount + usuário:
   ```ts
   .channel(`inbox_items_realtime:${user.id}:${crypto.randomUUID()}`)
   ```
   Isso evita colisão entre instâncias simultâneas e entre mount/unmount do StrictMode.

2. Manter o `return () => supabase.removeChannel(channel)` que já existe — agora ele garante limpeza correta do canal único.

## Por que é seguro

- Não muda contrato de dados, RLS ou tabela.
- Cada assinatura ainda escuta apenas mudanças do próprio `user_id` (filter já existente).
- Cost extra desprezível: 1 canal por componente montado (geralmente 1–2 simultâneos).
- Sem impacto em outras partes do app; o fix é localizado em um arquivo.

## Arquivos alterados

- `src/hooks/useInbox.ts` (1 linha)

## Validação

Após o fix:
- Abrir `/dashboard/projetos/central` — não deve mais cair no ErrorBoundary.
- Conferir console: nenhum erro `cannot add postgres_changes callbacks…`.
- Confirmar que o badge de inbox no sidebar continua atualizando em tempo real ao receber novo item.
