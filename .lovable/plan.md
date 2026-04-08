

# Corrigir Fotos de Influenciadores

## Diagnóstico

O sistema usa `unavatar.io` para buscar fotos de perfil, mas esse serviço falha frequentemente para Instagram e TikTok (plataformas que bloqueiam scraping). Além disso, quando o avatar é salvo no banco como URL do unavatar.io (durante cadastro/descoberta), essa URL quebrada persiste — o fallback nunca é acionado porque `existingUrl` já existe.

## Solução

### 1. Tratamento de erro no carregamento da imagem

**Arquivo:** `src/components/marketing/influencers/InfluencerProfileCard.tsx`
- No `AvatarImage`, adicionar `onError` handler que esconde a imagem e mostra o fallback (initials)
- Usar `onLoadingStatusChange` do Radix Avatar para controlar estado

### 2. Melhorar fallback em `influencer-avatar.ts`

**Arquivo:** `src/lib/utils/influencer-avatar.ts`
- Adicionar fallback para `ui-avatars.com` quando unavatar falhar
- Criar hook `useInfluencerAvatar` que tenta unavatar primeiro, e se a imagem falhar (via `onerror`), troca para `ui-avatars.com/api/?name=Username&background=random`

### 3. Aplicar em todos os componentes que exibem avatar

**Arquivos:**
- `InfluencerProfileCard.tsx` — usar hook com fallback
- `InfluencerProfile360.tsx` — mesma correção
- `InfluencerDiscovery.tsx` — usar `<Avatar>` com fallback ao invés de `<img>` direto

### Abordagem técnica

Criar um componente reutilizável `InfluencerAvatar` que:
1. Tenta carregar `avatar_url` do banco (pode ser unavatar.io)
2. Se falhar, tenta `unavatar.io/{platform}/{username}` 
3. Se falhar, usa `ui-avatars.com` com as iniciais do nome
4. Exibe iniciais como fallback final via `AvatarFallback`

```text
avatar_url (DB) → unavatar.io → ui-avatars.com → Iniciais (texto)
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/marketing/influencers/InfluencerAvatar.tsx` | Criar — componente com cadeia de fallbacks |
| `src/lib/utils/influencer-avatar.ts` | Modificar — adicionar URL de ui-avatars como último fallback |
| `src/components/marketing/influencers/InfluencerProfileCard.tsx` | Modificar — usar `InfluencerAvatar` |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — usar `InfluencerAvatar` |
| `src/components/marketing/influencers/InfluencerDiscovery.tsx` | Modificar — usar `InfluencerAvatar` |

