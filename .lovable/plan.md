## Problema atual

A função `discover-influencers` usa apenas `openai/gpt-5.2` via Lovable AI Gateway sem nenhuma ferramenta de busca real na web. O modelo é instruído a "consultar a web" mas **não tem acesso real** — ele apenas responde com base em conhecimento de treinamento, o que faz com que perfis recentes ou populares no Brasil (como #luluca) não sejam encontrados, ou venham com dados desatualizados/inventados.

## Objetivo

Melhorar drasticamente a qualidade da descoberta de influenciadores combinando:
1. Uma IA com **busca web real** (grounding) como motor principal.
2. APIs especializadas de inteligência de influenciadores como fonte de dados verificada quando disponível.
3. Um pipeline em camadas com fallback para garantir que sempre haja resultado relevante.

## Estratégia de busca em 3 camadas

```text
┌─────────────────────────────────────────────────────┐
│ Camada 1 — API especializada (dados verificados)    │
│   Modash / HypeAuditor / Phyllo Discovery (opcional)│
│   Retorna métricas reais, audiência, brand safety   │
└──────────────────┬──────────────────────────────────┘
                   │ se não houver chave OU sem resultado
                   ▼
┌─────────────────────────────────────────────────────┐
│ Camada 2 — IA com Google Search grounding           │
│   google/gemini-2.5-pro com web search real         │
│   Encontra perfis ATUAIS, hashtags e tendências BR  │
└──────────────────┬──────────────────────────────────┘
                   │ enriquecimento
                   ▼
┌─────────────────────────────────────────────────────┐
│ Camada 3 — Validação e enriquecimento               │
│   Perplexity Sonar (opcional) para validar números  │
│   unavatar.io para fotos de perfil reais            │
└─────────────────────────────────────────────────────┘
```

## APIs de mercado avaliadas

| API | Cobertura | Custo | Recomendação |
|---|---|---|---|
| **Modash Discovery** | 250M+ perfis IG/TikTok/YT, métricas, audiência, brand safety | Pago (a partir de ~US$ 120/mês) | **Top 1** — melhor para descoberta + filtros avançados |
| **HypeAuditor** | 80M+ perfis, AQS (audience quality score), fraud detection | Pago (sob consulta) | **Top 2** — melhor para análise de fraude/qualidade |
| **Phyllo Discovery** | Já temos integração (Connect SDK), mas o produto Discovery é módulo à parte | Pago | Aproveita infra existente, módulo Discovery precisa contratar |
| **Heepsy** | 11M+ perfis, foco micro-influencers | Pago, mais barato | Boa opção econômica |
| **InfluencerMarketing.ai** | 300M+ perfis, IA integrada | Pago | Concorrente forte da Modash |
| **Perplexity Sonar API** | Não é base de influencers, mas faz busca web grounded | Pago por request (barato) | **Excelente complemento** para validar dados em tempo real |
| **Google Gemini grounding** | Busca Google nativa | Incluso no Lovable AI Gateway | **Melhor opção sem custo extra** para começar |

**Recomendação imediata:** usar **Gemini 2.5 Pro com Google Search grounding** (já incluso, sem nova chave) + opcionalmente Perplexity Sonar como validador. Em seguida, oferecer Modash como upgrade premium quando o cliente quiser dados verificados.

## Mudanças no código

### Backend — `supabase/functions/discover-influencers/index.ts`
- Trocar provider primário para **Gemini 2.5 Pro** com `tools: [{ google_search: {} }]` para ter web grounding REAL.
- Adicionar fallback para `openai/gpt-5.2` caso o Gemini falhe.
- Melhorar o prompt para forçar busca por hashtag em IG/TikTok no Brasil quando a query começar com `#`.
- Estruturar saída via tool calling (não texto livre) — campo `search_queries_used` + `results[]` para auditoria.
- Detectar query do tipo hashtag, @username ou tema livre e ajustar a estratégia de busca.
- Adicionar opção (via env var) para chamar Modash/HypeAuditor/Perplexity quando configurados.
- Logar fonte usada para cada resultado (`source: "gemini_grounded" | "modash" | "perplexity"`).

### Frontend — `src/components/marketing/influencers/InfluencerDiscovery.tsx`
- Mostrar badge da **fonte** de cada resultado (ex.: "Verificado pela base Modash" vs "Encontrado via Google").
- Adicionar indicador "Buscando em fontes verificadas..." durante loading.
- Mostrar mensagem clara quando nenhum resultado for encontrado, com sugestões (tentar sem #, trocar plataforma etc.).
- Ajustar tratamento de erro para os novos códigos (`grounding_failed`, `no_provider_configured`).

### Configuração de secrets opcionais
- `MODASH_API_KEY` (opcional) — para ativar camada 1
- `HYPEAUDITOR_API_KEY` (opcional) — alternativa à Modash
- `PERPLEXITY_API_KEY` (opcional) — para validação cruzada
- Lovable AI Gateway já configurado — não precisa de nada novo

### Versionamento
- Bump `APP_VERSION` para `3.4.33` em `src/lib/version.ts`
- Adicionar entrada obrigatória no changelog em `src/components/erp/ApiDocumentation.tsx`

## Decisões necessárias do usuário

Antes de implementar, preciso confirmar:

1. **Começar com Gemini grounded (gratuito, dentro do Lovable AI) ou já contratar Modash/HypeAuditor agora?**
   - Recomendação: começar com Gemini grounded para resolver o problema imediato do #luluca, e contratar Modash depois se quiser dados verificados.

2. **Adicionar Perplexity Sonar como validador opcional?**
   - Custo baixo (~US$ 5 por 1000 buscas), grande aumento de precisão.

3. **Manter o limite de 12 resultados ou aumentar?**

## Resultado esperado

- Buscar `#luluca` → retorna o perfil correto da Luluca com seguidores atualizados, vindo do Google grounding.
- Buscar `tech reviewers Brasil` → retorna perfis brasileiros reais, não nomes inventados.
- Cada card mostra de qual fonte veio o dado, dando transparência ao usuário.
