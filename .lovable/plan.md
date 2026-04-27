
## Causa raiz

O erro `useInboxDrawer must be used within InboxDrawerProvider` aparece ao entrar em telas como `/dashboard/projetos/central` porque:

- O `InboxDrawerProvider` está embrulhado **dentro** do `DashboardLayout` (linha 133 de `src/components/dashboard/DashboardLayout.tsx`).
- Várias páginas, incluindo `CentralTrabalho.tsx`, `Projetos.tsx`, `ProjetoDetalhe.tsx`, `ProjetoVincularChina.tsx`, `ProjetosRelatorios.tsx`, `CentralPreferenciasConfig.tsx` e `admin/CalendarioCorporativo.tsx`, **não usam o `DashboardLayout`** — elas montam o próprio `<SidebarProvider>` + `<AppSidebar />` direto.
- O `AppSidebar` agora chama `useInboxDrawer()` (botão "Caixa de Entrada"), e como o provider não existe nessa árvore, o React lança o erro e a tela inteira quebra.

## Correção

Elevar o `InboxDrawerProvider` para o nível global do app (em `src/App.tsx`), garantindo que **qualquer** página que renderize o `AppSidebar` (via `DashboardLayout` ou diretamente) tenha acesso ao contexto. Também montar o `<InboxDrawer />` globalmente uma única vez para que o drawer funcione em todas essas rotas.

### Alterações

1. **`src/App.tsx`**
   - Importar `InboxDrawerProvider` e `InboxDrawer`.
   - Embrulhar a árvore de rotas autenticadas (dentro do `AuthProvider`/`QueryClientProvider`, fora do `BrowserRouter` ou logo dentro) com `<InboxDrawerProvider>`.
   - Montar `<InboxDrawer />` uma única vez no nível global para que o drawer abra em qualquer tela.

2. **`src/components/dashboard/DashboardLayout.tsx`**
   - Remover o `<InboxDrawerProvider>` local (agora vem do `App.tsx`) para evitar provider duplicado.
   - Remover o `<InboxDrawer />` local (também sobe para o `App.tsx`).
   - Manter o `InboxKeyboardShortcut` — ele continua funcionando porque o provider global engloba o layout.

### Observações

- Nenhuma funcionalidade muda: o atalho global `i`, o drawer, o sino de notificações e o botão "Caixa de Entrada" no sidebar continuam idênticos.
- O ajuste é puramente estrutural (escopo do provider), sem alterações visuais.
- Após a correção, todas as rotas afetadas (`/dashboard/projetos/central`, `/dashboard/projetos`, `/dashboard/projetos/:id`, `/dashboard/projetos/:id/vincular-china`, etc.) voltam a renderizar normalmente.
