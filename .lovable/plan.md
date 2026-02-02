
# Revisão de Segurança: Acesso ao Módulo Administrativo Trade

## Situação Atual

A configuração está **quase correta**, mas há um ponto de melhoria a ser feito.

### O que está funcionando corretamente:

| Componente | Status | Detalhes |
|------------|--------|----------|
| Tela `trade_admin` | ✅ Criada | Existe na tabela `telas_sistema` |
| Permissão da Milene | ✅ Atribuída | Única pessoa na `usuario_permissoes_telas` com `trade_admin` |
| Sidebar (AppSidebar) | ✅ Protegido | Filtra por `screenCode`, só mostra se tiver permissão |
| Rotas (App.tsx) | ✅ Protegidas | Usa `ScreenProtectedRoute` com `trade_admin` |
| TradeAdminModule | ✅ Protegido | Verifica `trade_admin` antes de renderizar |

### Problema identificado:

| Problema | Local | Impacto |
|----------|-------|---------|
| Link visível sem verificação | `TradeModule.tsx` linha 80 | Qualquer pessoa com Trade pode VER o link (mas não acessar) |

O link "Campanhas & Verbas" no menu do TradeModule é mostrado para todos os usuários com acesso ao Trade, mas ao clicar, eles são redirecionados por não terem permissão. Isso pode confundir os usuários.

---

## Nota sobre Administradores

O usuário **Leandro (admin)** também consegue acessar o módulo administrativo porque, por design de segurança, administradores têm acesso total a todas as telas (`isAdmin = true` retorna `true` para qualquer permissão).

Se você deseja bloquear **inclusive administradores**, isso requer uma mudança significativa na lógica de permissões do sistema.

---

## Correção Proposta

Ocultar o link "Administrativo" no `TradeModule.tsx` para quem não tem permissão:

**Arquivo:** `src/pages/modules/TradeModule.tsx`

**Alteração:** Adicionar verificação de permissão antes de mostrar a seção "Administrativo":

```tsx
// De (linha 78-81):
const secondaryModules = {
  "Administrativo": [
    { title: "Campanhas & Verbas", to: "/dashboard/trade/admin", ... },
  ],
  // ...
};

// Para:
const secondaryModules = {
  ...(hasPermission("trade_admin") ? {
    "Administrativo": [
      { title: "Campanhas & Verbas", to: "/dashboard/trade/admin", ... },
    ],
  } : {}),
  // ...
};
```

---

## Resumo das Alterações

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| 🔒 Código | `TradeModule.tsx` | Esconder seção "Administrativo" para quem não tem permissão |

---

## Resultado Esperado

- ✅ O link "Administrativo" só aparece para Milene e administradores do sistema
- ✅ Outros usuários do Trade não verão mais o link confuso
- ✅ As rotas continuam protegidas por camada dupla de segurança
