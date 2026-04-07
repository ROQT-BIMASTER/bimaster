

# Sincronização Asana no Menu de Administração

## Situação Atual

O link "Asana Sync" **já existe** no menu de Administração, na seção "Sistema & Integrações" (linha 1419 do `AppSidebar.tsx`). Está dentro do bloco `{isAdmin && ...}`, visível apenas para admins.

No entanto, está agrupado junto com itens genéricos de sistema. Para consistência com o que foi feito para os botões de Sync do ERP (Contas a Pagar e Contas a Receber), faz sentido **reorganizar** — mover o Asana Sync para junto dos outros itens de sincronização.

## Alteração

### `src/components/dashboard/AppSidebar.tsx`

1. **Remover** o link Asana Sync da seção "Sistema & Integrações" (linha 1419)
2. **Adicionar** na seção "Governança Financeira", junto dos outros links de sync, ou criar um sub-grupo "Sincronizações" dedicado que agrupe:
   - Sync Contas a Pagar
   - Sync Contas a Receber
   - Sync Cadastros AP
   - Asana Sync

Apenas 1 arquivo modificado: `AppSidebar.tsx` — mover uma linha de posição.

