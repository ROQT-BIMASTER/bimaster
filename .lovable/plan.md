

## Problema

A imagem do avatar está distorcendo porque o `AvatarImage` usa `aspect-square h-full w-full` sem `object-cover`, fazendo com que fotos não-quadradas sejam esticadas. Além disso, os tamanhos ainda podem ser um pouco maiores para melhor visibilidade.

## Plano

### Arquivo: `src/pages/ProjetosMinhaEquipe.tsx`

1. **Adicionar `object-cover`** ao `AvatarImage` para que a foto seja recortada proporcionalmente em vez de distorcida:
   - `<AvatarImage src={avatarSrc} className="object-cover" />`

2. **Aumentar tamanhos dos avatares**:
   - Hierarquia (md): de `h-11 w-11` → `h-14 w-14` (56px)
   - Ranking (sm): de `h-9 w-9` → `h-11 w-11` (44px)
   - Ajustar ícones proporcionalmente

### Arquivo: `src/components/ui/avatar.tsx`

3. **Adicionar `object-cover`** como classe padrão no componente `AvatarImage` para beneficiar toda a aplicação:
   - De `"aspect-square h-full w-full"` → `"aspect-square h-full w-full object-cover"`

