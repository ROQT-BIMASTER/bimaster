

# Diagnóstico: Fotos de Influenciadores e Organização Geral

## Causa Raiz — Fotos Não Carregam

Os dados no banco confirmam: **todos os `avatar_url` são `NULL`**. Isso acontece por dois motivos:

1. **Descoberta com IA (`discover-influencers`)**: O prompt da IA explicitamente define `"avatar_url": null` (linha 52). A IA nunca retorna URLs de avatar. Quando o usuário adiciona um influenciador descoberto ao monitoramento, o `avatar_url` é salvo como `null`.

2. **Cadastro manual (`AddInfluencerDialog`)**: O formulário não tem campo para avatar. O campo `avatar_url` nunca é preenchido.

3. **O componente `InfluencerProfileCard`** usa `influencer.avatar_url` diretamente sem resolver via `useResolvedAvatarUrl` (que só serve para URLs do storage interno — irrelevante aqui, pois não há URLs externas salvas).

## Solução Proposta

### 1. Buscar avatares automaticamente via Edge Function

Criar uma ação na `phyllo-proxy` (ou nova função `fetch-influencer-avatar`) que:
- Recebe `platform` + `username`
- Usa a API Phyllo (`search_creators`) para encontrar o perfil
- Retorna o `image_url` / `profile_pic_url` do resultado
- Atualiza o campo `avatar_url` na tabela `influencers`

### 2. Atualizar `discover-influencers` para buscar avatares

Modificar o prompt da IA para que tente retornar URLs de avatar reais quando possível (embora a IA não consiga garantir URLs válidas). Uma alternativa mais confiável: após a descoberta, fazer um segundo passo que busca o avatar via Phyllo/scraping.

### 3. Fallback com geração de avatar

Para influenciadores sem foto, usar um serviço de avatar gerado (ex: `ui-avatars.com` ou `unavatar.io`) como fallback:
```
https://unavatar.io/instagram/{username}
```
Este serviço retorna o avatar real do Instagram/Twitter/etc.

### 4. Atualizar o componente `InfluencerProfileCard`

Adicionar fallback de avatar usando `unavatar.io`:
```typescript
const avatarSrc = influencer.avatar_url || 
  `https://unavatar.io/${influencer.platform}/${influencer.username}`;
```

---

## Itens de Organização Identificados

| Item | Status | Problema |
|---|---|---|
| Avatar dos influenciadores | Não funciona | `avatar_url` sempre NULL |
| Phyllo Connect (Redes Sociais) | Funcional | Depende de PHYLLO_CLIENT_ID/SECRET configurados |
| Edge Functions Phyllo | Funcionais | Logs mostram boot normal |
| Abas do SocialAccountPanel | Completas | 6 abas: Perfil, Conteúdo, Audiência, Engajamento, Receita, Publicar |
| InfluencerProfile360 | Funcional | Depende de avatar para exibição visual |
| `useResolvedAvatarUrl` hook | Não utilizado | Existe mas não é usado nos cards de influenciadores |

## Plano de Implementação

### Passo 1 — Fallback de avatar imediato (sem API externa)
- Modificar `InfluencerProfileCard.tsx` e `InfluencerProfile360.tsx` para usar `unavatar.io` como fallback
- `https://unavatar.io/{platform}/{username}` retorna avatares reais do Instagram, Twitter, YouTube, etc.

### Passo 2 — Enriquecer dados existentes
- Criar botão "Atualizar Avatares" ou processo automático que percorre influenciadores sem avatar e busca via `unavatar.io` ou Phyllo, salvando o resultado no banco

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/components/marketing/influencers/InfluencerProfileCard.tsx` | Adicionar fallback de avatar via unavatar.io |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Mesmo fallback de avatar |
| `src/components/marketing/influencers/InfluencerDiscovery.tsx` | Adicionar avatar_url com unavatar.io ao salvar |
| `src/components/marketing/influencers/AddInfluencerDialog.tsx` | Gerar avatar_url automaticamente ao cadastrar |

