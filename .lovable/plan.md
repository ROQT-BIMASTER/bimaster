

## Implementação LGPD Completa — 3 Funcionalidades

### 1. Registro de Aceite de Termos

**Banco de dados** — nova tabela `terms_acceptance`:
- `id` (uuid, PK), `user_id` (uuid, NOT NULL), `document_type` (text — 'privacy_policy' ou 'terms_of_use'), `document_version` (text), `accepted_at` (timestamptz), `ip_address` (text nullable)
- RLS: usuário só lê seus próprios registros; insert para authenticated
- Unique constraint em `(user_id, document_type, document_version)`

**Componente** — `TermsAcceptanceModal.tsx`:
- Modal que aparece no `DashboardLayout` quando o usuário logado não tem aceite registrado para a versão atual dos termos
- Exibe links para Política de Privacidade e Termos de Uso
- Checkbox + botão "Aceitar e Continuar"
- Ao aceitar, insere registro na tabela e fecha o modal
- Hook `useTermsAcceptance` que consulta se o usuário já aceitou a versão vigente

**Integração**: Adicionar o modal no `DashboardLayout.tsx` após o header.

---

### 2. Ferramenta LGPD para Admin (Exportar/Excluir Dados)

**Nova página** — `src/pages/LGPDAdmin.tsx`:
- Acessível em `/dashboard/configuracoes/lgpd` (admin only)
- Busca por email/nome de usuário
- **Exportar**: Coleta dados de `profiles`, `team_members`, `team_member_details`, `terms_acceptance`, `audit_logs` do usuário e gera JSON para download
- **Anonimizar**: Substitui dados pessoais (nome, email, telefone, CPF) por valores anonimizados, cumprindo Art. 18 LGPD (não deleta registros para manter integridade referencial)

**Rota**: Protegida por `ProtectedRoute` + verificação de role admin no componente.

**Sidebar**: Adicionar item "LGPD" no grupo de Configurações (apenas para admins).

---

### 3. Links de Política no Dashboard

**Footer do Sidebar** (`AppSidebar.tsx`):
- Antes do botão de logout, adicionar links discretos para `/politica-privacidade` e `/termos-de-uso`
- Estilo: texto pequeno, muted, com ícone `FileText`

---

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/auth/TermsAcceptanceModal.tsx` |
| Criar | `src/hooks/useTermsAcceptance.ts` |
| Criar | `src/pages/LGPDAdmin.tsx` |
| Editar | `src/components/dashboard/DashboardLayout.tsx` (adicionar modal) |
| Editar | `src/components/dashboard/AppSidebar.tsx` (links legais + item LGPD) |
| Editar | `src/App.tsx` (rota LGPD) |
| Migração | Tabela `terms_acceptance` + RLS |

