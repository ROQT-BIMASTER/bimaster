## Problema

A tela `/dashboard/security/mfa` aparece "solta" no fundo cinza, sem a barra lateral nem o cabeçalho do dashboard (conforme screenshot). O conteúdo (cards "Status" e "Configurar MFA") está correto, mas o layout do app não está envolvendo a página.

## Causa raiz

Neste projeto, o "esqueleto" do dashboard (sidebar + header + breadcrumbs) é aplicado **por página**, via componente `<DashboardLayout>` importado de `@/components/dashboard/DashboardLayout`. Páginas como `Configuracoes.tsx`, `SecurityDashboard.tsx`, etc. envolvem seu conteúdo nesse layout.

`src/pages/security/MfaSettingsPage.tsx` retorna direto `<div className="container max-w-3xl py-8 ...">` sem `DashboardLayout`. Por isso, ao acessar a rota, só o conteúdo "miolo" aparece — sem sidebar, sem header.

A rota em `src/App.tsx:784` está correta (usa `<ProtectedRoute>`); o problema é exclusivamente na página.

## Correção (somente UI)

Editar **um único arquivo**: `src/pages/security/MfaSettingsPage.tsx`.

1. Importar `DashboardLayout`:
   ```ts
   import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
   ```

2. Envolver o `return (...)` atual com `<DashboardLayout> ... </DashboardLayout>`.

3. Tratar também o estado de loading (`if (loading && !status) return <div className="p-6">Carregando…</div>;`) dentro do `DashboardLayout`, para que mesmo durante o carregamento o usuário veja a navegação.

Nada de lógica, hooks, edge functions, RLS ou design tokens muda. Continuamos usando `bg-card`, `text-muted-foreground`, etc. — sem cores literais.

## Validação

- Recarregar `/dashboard/security/mfa` no preview e confirmar que sidebar + header aparecem, com os cards "Status" e "Configurar MFA" no centro.
- Conferir que o badge "Inativo" e o botão "Iniciar configuração" continuam funcionais.
- Sem mudanças em build/CI/segurança — não toca em headers, worker, scripts E2E nem migrations.

## Arquivos alterados

- `src/pages/security/MfaSettingsPage.tsx` (apenas wrapper de layout)
