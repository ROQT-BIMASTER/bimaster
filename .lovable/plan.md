

## Diagnóstico

As alterações de hoje foram aplicadas nos componentes do **Trade Marketing** (`TeamMemberRegistration.tsx`, `TeamMemberFormDialog.tsx`), mas a tela **"Minha Equipe — Projetos"** (`ProjetosMinhaEquipe.tsx`) é um componente completamente separado que **não foi atualizado**. Por isso os badges continuam com baixo contraste e não há opção de upload de foto.

A tela de Projetos ainda usa o antigo `getRoleBadgeClass` com cores fracas (ex: `bg-accent/10 text-accent-foreground`) e não tem nenhuma lógica de upload de avatar.

## Plano de Implementação

### 1. Badges de alto contraste em ProjetosMinhaEquipe.tsx
- Substituir `getRoleBadgeClass` pelo mesmo padrão `ROLE_CONFIG` já usado no Trade, com cores fortes por cargo (Gerente = roxo, Supervisor = azul, Vendedor = verde, etc.) e suporte a dark mode.

### 2. Upload inline de foto no avatar (Projetos)
- Ao clicar no avatar de um membro na hierarquia ou no ranking, abrir file picker para upload direto.
- Mostrar overlay de câmera no hover (mesmo padrão visual do Trade).
- Upload para bucket `avatars` com path `{user_id}/avatar.{ext}`, update do `avatar_url` na tabela `profiles`.
- Gerar signed URL para exibição (bucket é privado).
- Restringir upload a admin, gerente e supervisor (verificação client-side via `useUserRole`).
- Exibir avatares existentes com signed URL via `useResolvedAvatarUrl` hook.

### 3. Versão e cache
- Incrementar `APP_VERSION` para `2.7.0` para forçar invalidação de cache/PWA.

### Detalhes Técnicos

**Arquivo modificado:** `src/pages/ProjetosMinhaEquipe.tsx`
- Importar `supabase`, `useUserRole`, `useResolvedAvatarUrl`, `Camera`, `Loader2`, `toast`
- Criar componente `AvatarWithUpload` que encapsula Avatar + overlay + file input + upload logic
- Usar `useResolvedAvatarUrl` para resolver signed URLs dos avatares privados
- Aplicar `ROLE_CONFIG` idêntico ao do Trade para badges

**Arquivo modificado:** `src/lib/version.ts`
- `APP_VERSION = '2.7.0'`

**Nenhuma migração necessária** — as políticas de storage para supervisores/gerentes já existem (migration `20260312122346`).

