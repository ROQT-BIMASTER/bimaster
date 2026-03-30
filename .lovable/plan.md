

# LGPD — Permitir Edição de Dados pelo Usuário no Portal

## Contexto

O `PortalPerfil` (portal do cliente em `/portal/perfil`) é **somente leitura** — exibe nome, email e data de cadastro sem possibilidade de edição. A LGPD (Art. 18, III) garante ao titular o direito de **correção de dados incompletos, inexatos ou desatualizados**.

O dashboard interno (`EditarPerfil`) já permite edição de Nome, Telefone e Cargo. O portal do cliente precisa do mesmo tratamento.

## Plano

### 1. Adicionar edição inline ao PortalPerfil

Transformar os campos Nome e Telefone em editáveis (toggle edit/view), mantendo Email como read-only com ícone de cadeado e explicação LGPD. Campos editáveis:

| Campo | Editável | Justificativa |
|-------|----------|---------------|
| Nome | Sim | Direito de correção (Art. 18) |
| Telefone | Sim | Dado pessoal atualizável |
| Email | Não | Identificador único, bloqueado |
| CNPJs | Não | Vínculo administrativo |

### 2. Implementação

- Adicionar estados `isEditing`, `saving`, `formData`, `errors` ao `PortalPerfil`
- Buscar campo `telefone` junto com `nome, email, created_at` na query do profile
- Reutilizar `profileSchema` de `src/lib/validations/profile.ts` para validação
- Botão "Editar Meus Dados" / "Salvar" / "Cancelar" no card de Dados Pessoais
- Update via `supabase.from("profiles").update({ nome, telefone }).eq("id", user.id)`
- Toast de sucesso/erro
- Texto explicativo LGPD no rodapé do card: "Conforme Art. 18 da LGPD, você pode corrigir seus dados pessoais a qualquer momento."

### 3. Upload de avatar (opcional)

Reutilizar `ProfileAvatarUpload` existente para permitir foto de perfil no portal, com o componente já disponível em `src/components/shared/ProfileAvatarUpload.tsx`.

## Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `src/pages/portal/PortalPerfil.tsx` | Adicionar edição de Nome/Telefone, avatar, validação Zod, texto LGPD |

