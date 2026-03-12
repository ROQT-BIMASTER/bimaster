

## Problema

Os avatares estão muito pequenos (`h-8 w-8` = 32px na hierarquia, `h-7 w-7` = 28px no ranking). A foto enviada pode não estar aparecendo corretamente por causa do tamanho reduzido e possivelmente o `useResolvedAvatarUrl` não estar resolvendo a URL após o upload.

## Plano

### 1. Aumentar tamanho dos avatares

- **Hierarquia (size="md")**: de `h-8 w-8` para `h-11 w-11` (44px) — visível e proporcional ao layout
- **Ranking (size="sm")**: de `h-7 w-7` para `h-9 w-9` (36px)
- Ajustar ícones da câmera proporcionalmente

### 2. Garantir exibição da foto após upload

- Adicionar estado local `localUrl` no `AvatarWithUpload` que é atualizado imediatamente após upload bem-sucedido, sem depender do hook `useResolvedAvatarUrl` para atualizar (que pode ter cache)
- Usar `localUrl || resolved` como src do `AvatarImage`

### Arquivo modificado
- `src/pages/ProjetosMinhaEquipe.tsx` — componente `AvatarWithUpload` (tamanhos + estado local pós-upload)

