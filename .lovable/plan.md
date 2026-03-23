

# Fix: Dialog fecha ao abrir documento em nova aba

## Problema

Quando o usuário clica "Abrir" no anexo, o `window.open` abre uma nova aba. O Radix Dialog detecta perda de foco/interação fora e fecha automaticamente o dialog. Isso causa retrabalho pois o operador perde todo o estado da revisão.

## Solução

Adicionar `onInteractOutside` e `onPointerDownOutside` com `e.preventDefault()` no `DialogContent` do `PaymentReviewDialog.tsx` — mesmo padrão já usado em outros dialogs do projeto (ex: `NovoProdutoImportadoDialog`, `NovoProdutoAcabadoDialog`).

Isso impede que cliques fora ou perda de foco fechem o dialog. O usuário só fecha via botões explícitos ("Fechar", "Aceitar", "Rejeitar").

## Alteração

**`src/components/financeiro/payments/PaymentReviewDialog.tsx`** — linha 262:

```tsx
// De:
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

// Para:
<DialogContent 
  className="max-w-2xl max-h-[90vh] overflow-y-auto"
  onInteractOutside={(e) => e.preventDefault()}
  onPointerDownOutside={(e) => e.preventDefault()}
>
```

Uma única linha alterada. O dialog só fechará por ação explícita do usuário.

