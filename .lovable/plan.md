

# Melhorias Identificadas — Plano de Implementacao

## Nota Atual: 85/100

O sistema e maduro e robusto. Abaixo estao as melhorias priorizadas para atingir 95-100/100.

---

## Melhoria 1: Recuperacao de Senha (Alta Prioridade)

Atualmente NAO existe fluxo de "Esqueci minha senha". Implementar:

**Novos arquivos:**
- `src/components/auth/ForgotPasswordForm.tsx` — formulario com campo de email, envia link via `supabase.auth.resetPasswordForEmail()` com `redirectTo` para `/reset-password`
- `src/pages/ForgotPassword.tsx` — pagina wrapper com AuthLayout
- `src/pages/ResetPassword.tsx` — pagina para definir nova senha, valida token `type=recovery` no URL hash, chama `supabase.auth.updateUser({ password })`, com validacao Zod (8+ chars, maiuscula, numero)

**Alteracoes:**
- `src/components/auth/LoginForm.tsx` — adicionar link "Esqueci minha senha" abaixo do campo de senha
- `src/App.tsx` — adicionar rotas `/auth/forgot-password` e `/reset-password` (publica, fora de ProtectedRoute)

---

## Melhoria 2: Visual do Login (Alta Prioridade)

**Alteracoes em `LoginForm.tsx`:**
- Adicionar toggle de visibilidade de senha (icone olho/olho fechado)
- Adicionar link "Esqueci minha senha" entre campo senha e botao Entrar

**Alteracoes em `AuthLayout.tsx`:**
- Adicionar logo `logo-huugs.jpg` acima do titulo
- Melhorar gradiente de fundo com pattern sutil

---

## Melhoria 3: Refatorar AppSidebar (Media Prioridade)

O arquivo tem 1409 linhas. Extrair em modulos:
- `src/components/sidebar/ModuleHeader.tsx`
- `src/components/sidebar/MenuItemLink.tsx`
- `src/components/sidebar/CategoryDivider.tsx`
- `src/components/sidebar/SidebarModuleFilter.tsx`
- `src/components/sidebar/SidebarUserFooter.tsx`
- `src/components/sidebar/module-configs.ts` (fabricaGroups, moduleColors, moduleSearchTitles)

AppSidebar.tsx ficaria com ~400 linhas (composicao).

---

## Melhoria 4: Dashboard com KPIs Reais (Media Prioridade)

Adicionar ao Dashboard:
- KPI cards com dados reais (total clientes ativos, total contas a pagar pendentes, total contas a receber em aberto, tarefas do usuario)
- Widget "Minhas Tarefas" mostrando proximas 5 tarefas com deadline

---

## Arquivos a criar/alterar

| Arquivo | Acao |
|---|---|
| `src/components/auth/ForgotPasswordForm.tsx` | Criar |
| `src/pages/ForgotPassword.tsx` | Criar |
| `src/pages/ResetPassword.tsx` | Criar |
| `src/components/auth/LoginForm.tsx` | Alterar (toggle senha, link esqueci) |
| `src/components/auth/AuthLayout.tsx` | Alterar (logo, visual) |
| `src/App.tsx` | Alterar (2 novas rotas) |
| `src/components/sidebar/ModuleHeader.tsx` | Criar (extrair) |
| `src/components/sidebar/MenuItemLink.tsx` | Criar (extrair) |
| `src/components/sidebar/CategoryDivider.tsx` | Criar (extrair) |
| `src/components/sidebar/SidebarModuleFilter.tsx` | Criar (extrair) |
| `src/components/sidebar/SidebarUserFooter.tsx` | Criar (extrair) |
| `src/components/sidebar/module-configs.ts` | Criar (extrair) |
| `src/components/dashboard/AppSidebar.tsx` | Alterar (importar extraidos) |
| `src/pages/Dashboard.tsx` | Alterar (KPIs reais) |

