

# Corrigir Erro "Rendered more hooks than during the previous render" no PostDetailDialog

## Diagnóstico

O componente `PostDetailDialog` tem um `return null` na linha 63 (antes de `post` ter valor) que vem **antes** do `useMemo` na linha 66. Isso viola a regra do React de que hooks devem ser chamados sempre na mesma ordem. Quando `post` passa de `null` para um objeto, o React detecta que há mais hooks que na renderização anterior e quebra.

## Correção

**Arquivo:** `src/components/marketing/influencers/PostDetailDialog.tsx`

Mover o `useMemo` e toda lógica derivada para **antes** do early return, e proteger o `useMemo` internamente contra `post` nulo:

```typescript
// ANTES do if (!post) return null:
const media = useMemo(() => post ? getPostMediaSource(post) : null, [post]);

if (!post) return null;

// Agora pode usar media com segurança (post existe aqui)
const resolvedMediaKind = mediaFailed ? "image" : media!.kind;
const resolvedMediaSrc = mediaFailed ? media!.fallback : media!.src;
```

Isso garante que o `useMemo` é chamado em **toda** renderização, independente de `post` ser nulo ou não.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/marketing/influencers/PostDetailDialog.tsx` | Modificar — mover `useMemo` antes do early return |

