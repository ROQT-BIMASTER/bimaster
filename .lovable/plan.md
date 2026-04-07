

# Telas Estratégicas para Agência — Planejamento de Marketing para Clientes

## Resumo

Criar um conjunto de telas dentro do módulo Marketing que transformem o sistema em uma plataforma de planejamento estratégico para agências, permitindo construir e gerenciar estratégias completas para cada cliente.

## Novas Telas

### 1. Central de Clientes da Agência (`AgencyClientsHub`)
Visão consolidada de todos os clientes da agência com:
- Cards por cliente com logo, segmento, status do contrato, budget mensal
- KPIs rápidos: campanhas ativas, ROI médio, próximas entregas
- Filtros por segmento, status, responsável interno
- Tabela `agency_clients` (nome, logo_url, segmento, budget_mensal, contrato_inicio, contrato_fim, responsavel_id)

### 2. Brand Strategy Canvas (`BrandStrategyCanvas`)
Canvas visual interativo por cliente com:
- **Persona Builder**: Criar personas com IA (idade, dores, motivações, canais preferidos) — salvo em JSONB
- **Análise SWOT**: Quadrante editável com sugestões de IA
- **Tom de Voz**: Definição de personalidade da marca (formal/informal, técnico/acessível) com exemplos gerados por IA
- **Posicionamento**: Mapa perceptual (eixos configuráveis) posicionando cliente vs concorrentes
- Tabela `brand_strategies` (agency_client_id, tipo: persona/swot/voice/positioning, content JSONB)

### 3. Funil de Conteúdo e Jornada (`ContentFunnelPlanner`)
Planejamento visual de conteúdo mapeado ao funil:
- Colunas: Topo (Awareness) → Meio (Consideration) → Fundo (Decision) → Pós-venda (Retention)
- Cards de conteúdo arrastáveis entre etapas com: formato (post, reel, story, blog, email), status, data prevista
- IA sugere conteúdos para cada etapa baseado no segmento e personas do cliente
- Tabela `content_funnel_items` (agency_client_id, etapa_funil, formato, titulo, descricao, status, data_prevista)

### 4. Análise Competitiva (`CompetitorAnalysis`)
Dashboard de inteligência competitiva:
- Cadastro de concorrentes por cliente com monitoramento de redes sociais (integra com influenciadores/Phyllo existente)
- Comparativo lado a lado: seguidores, engajamento, frequência de posts, tom de comunicação
- IA analisa diferenciação e oportunidades
- Tabela `competitor_profiles` (agency_client_id, nome, plataforma, username, followers, engagement_rate, ai_analysis JSONB)

### 5. Gerador de Briefing com IA (`AIBriefingGenerator`)
Criar briefings profissionais automaticamente:
- Formulário guiado: objetivo, público, canais, budget, prazo, referências visuais
- IA gera briefing completo em formato profissional (PDF exportável)
- Histórico de briefings por cliente
- Tabela `campaign_briefings` (agency_client_id, titulo, objetivo, publico, canais, budget, conteudo_gerado, status)

### 6. Calendário Editorial Unificado (`UnifiedEditorialCalendar`)
Calendário mensal/semanal com visão multi-cliente:
- Cores por cliente, filtros por plataforma e formato
- Drag-and-drop para reagendar
- Integração com o Content Funnel (etapa do funil visível)
- Status: rascunho → em aprovação → aprovado → publicado
- Usa a tabela `content_funnel_items` existente + campo `published_at`

### 7. Relatório de Performance por Cliente (`ClientPerformanceReport`)
Relatório executivo mensal gerado por IA:
- Consolida métricas de todas as plataformas monitoradas
- Compara com metas definidas na estratégia
- Gráficos de evolução (seguidores, engajamento, alcance, conversões)
- IA gera análise textual com insights e recomendações
- Exportável em PDF para apresentar ao cliente
- Tabela `client_reports` (agency_client_id, periodo, metricas JSONB, ai_analysis, status)

## Migração SQL

Criar tabelas: `agency_clients`, `brand_strategies`, `content_funnel_items`, `competitor_profiles`, `campaign_briefings`, `client_reports` — todas com RLS por user_id.

## Edge Function

`agency-strategy-ai` — função única que recebe `action` (generate_persona, generate_swot, suggest_content, analyze_competitor, generate_briefing, generate_report) e usa Gemini 2.5 Flash para gerar os resultados.

## Navegação

Nova seção "Estratégia" no menu do Marketing com sub-itens para cada tela, ou uma página hub `/dashboard/marketing/strategy` com cards de acesso.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar 6 tabelas com RLS |
| `supabase/functions/agency-strategy-ai/index.ts` | Criar — IA estratégica |
| `src/pages/marketing/StrategyHub.tsx` | Criar — hub de navegação |
| `src/components/marketing/strategy/AgencyClientsHub.tsx` | Criar |
| `src/components/marketing/strategy/BrandStrategyCanvas.tsx` | Criar |
| `src/components/marketing/strategy/ContentFunnelPlanner.tsx` | Criar |
| `src/components/marketing/strategy/CompetitorAnalysis.tsx` | Criar |
| `src/components/marketing/strategy/AIBriefingGenerator.tsx` | Criar |
| `src/components/marketing/strategy/UnifiedEditorialCalendar.tsx` | Criar |
| `src/components/marketing/strategy/ClientPerformanceReport.tsx` | Criar |
| `src/App.tsx` | Adicionar rotas |
| `src/pages/Marketing.tsx` | Adicionar item no menu |

