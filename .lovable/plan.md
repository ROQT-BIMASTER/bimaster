

# Integração Phyllo — Monitoramento de Influenciadores

## O que é o Phyllo

Phyllo é uma API unificada para dados sociais que cobre **Instagram, TikTok, YouTube, Twitter, Facebook, LinkedIn** e dezenas de outras plataformas. O foco principal é **influencer marketing**, oferecendo:

- **Descoberta**: Buscar influenciadores por filtros (nicho, localização, engajamento)
- **Perfil e Audiência**: Dados demográficos dos seguidores (idade, localização, interesses)
- **Métricas em tempo real**: Reach, impressões, engajamento, conversões
- **Detecção de fraude**: Identificação de seguidores falsos
- **Rastreamento de campanhas**: ROI e performance de conteúdo patrocinado

## Comparação com a abordagem atual

| Aspecto | Atual (Meta API direta) | Phyllo |
|---|---|---|
| Plataformas | Instagram + Facebook apenas | 100+ plataformas |
| Token management | Manual (renovação a cada 60 dias) | Phyllo gerencia automaticamente |
| Dados de audiência | Limitado | Demográficos completos |
| Detecção de fraude | Não tem | Incluído |
| Busca de influenciadores | Não tem | Incluído |
| Preço | Grátis (API Meta) | Sob consulta (customizado) |

## Pré-requisitos

1. **Contratar o Phyllo**: O pricing é customizado — a equipe precisa solicitar um orçamento em [getphyllo.com/get-demo](https://getphyllo.com/get-demo)
2. **Obter credenciais da API**: `CLIENT_ID` e `CLIENT_SECRET` fornecidos após a contratação
3. **Configurar o Phyllo SDK Token** (server-side) para autenticar chamadas

## Plano de implementação (após contratação)

### Fase 1 — Infraestrutura base

**Edge Function `phyllo-proxy`**
- Armazena CLIENT_ID e CLIENT_SECRET como secrets do projeto
- Gera tokens de sessão via `POST https://api.getphyllo.com/v1/sdk-tokens`
- Proxy todas as chamadas à API Phyllo (perfis, métricas, audiência)

**Migration — Tabela `influencers`**
- `id`, `user_id`, `phyllo_account_id`, `platform`, `username`, `display_name`, `followers_count`, `engagement_rate`, `audience_data` (JSONB), `fraud_score`, `last_synced_at`

### Fase 2 — Interface de monitoramento

**Nova aba "Influenciadores" no módulo de Marketing**
- Dashboard com cards de influenciadores monitorados
- Métricas: seguidores, engajamento, reach, impressões
- Gráficos de evolução temporal
- Score de autenticidade (detecção de fraude)
- Dados demográficos da audiência (gráficos de pizza/barras)

**Busca e descoberta**
- Formulário de busca por plataforma, nicho, localização
- Resultados com preview de perfil e métricas
- Botão "Adicionar ao monitoramento"

### Fase 3 — Campanhas e ROI

- Vincular influenciadores a campanhas
- Rastrear posts patrocinados e medir performance
- Relatórios de ROI por influenciador e campanha

## Arquivos envolvidos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/phyllo-proxy/index.ts` | Nova edge function para comunicação com API Phyllo |
| Migration SQL | Tabela `influencers` + `influencer_campaigns` |
| `src/components/marketing/influencers/` | Novo módulo com Dashboard, Search, ProfileCard |
| `src/components/marketing/SocialMediaMonitoring.tsx` | Nova aba "Influenciadores" |

## Próximo passo recomendado

Antes de implementar, a equipe de TI precisa:
1. Agendar demo com Phyllo para entender pricing e escopo
2. Após contratação, fornecer `CLIENT_ID` e `CLIENT_SECRET`
3. Com as credenciais em mãos, posso implementar toda a integração

