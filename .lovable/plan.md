

# Descoberta de Influenciadores com IA + Monitoramento

## Conceito

O usuário descreve em linguagem natural o que procura (perfil, hashtag, marca, nicho) e a IA busca influenciadores reais na web. Cada resultado pode ser adicionado ao monitoramento com um clique, salvando na tabela `influencers` existente. Suporta busca por **perfil**, **hashtag (#)** e **marca**.

## Pré-requisito

Conectar o **Perplexity** como conector do projeto para obter a chave de API necessária para busca web com IA.

## Componentes

### 1. Edge Function `discover-influencers`
- Recebe `query` (texto livre) e filtros opcionais (`platform`, `min_followers`, `max_followers`)
- Usa Perplexity API (`sonar-pro`) com structured output (JSON schema) para retornar lista de influenciadores
- System prompt instrui a IA a buscar perfis reais com: username, plataforma, seguidores estimados, engajamento estimado, nicho, justificativa
- Suporta buscas por hashtag (ex: "#modasustentavel"), marca (ex: "Nike Brasil") ou descrição livre

### 2. Componente `InfluencerDiscovery.tsx`
- Campo de busca com placeholder: "Busque por perfil, #hashtag, marca ou descrição..."
- Chips de exemplo clicáveis: "#fitness", "Natura", "tech reviewers SP", "@influencer"
- Filtros opcionais: plataforma, faixa de seguidores
- Resultados em cards com: nome, plataforma, seguidores, engajamento, nicho, motivo da recomendação
- Botão **"Monitorar"** em cada card — insere na tabela `influencers` com status `active`
- Estado de loading com skeleton

### 3. Integração no Dashboard
- Botão "Descobrir com IA" no `InfluencerDashboard.tsx` ao lado de "Adicionar Influenciador"
- Abre dialog/painel com o componente de descoberta
- Após adicionar, atualiza a lista de influenciadores monitorados

## Fluxo

```text
Usuário digita: "#skincare influenciadores Instagram 10k-100k"
    |
Edge Function -> Perplexity sonar-pro (busca web em tempo real)
    |
Retorna JSON estruturado: [{username, platform, followers, engagement, niche, reason}]
    |
Frontend exibe cards com dados
    |
Usuário clica "Monitorar" -> INSERT na tabela influencers -> atualiza dashboard
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/discover-influencers/index.ts` | Criar — edge function com Perplexity |
| `src/components/marketing/influencers/InfluencerDiscovery.tsx` | Criar — UI de busca e resultados |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — adicionar botão "Descobrir com IA" |

