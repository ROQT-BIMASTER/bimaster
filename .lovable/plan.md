

# Painel de Detalhamento de Dados Minerados pelo Autopilot

## Objetivo

Expandir o painel de dados minerados com uma página/modal de detalhamento completo, permitindo ao usuário explorar cada registro (influenciadores, posts, comentários, análises, oportunidades) com filtros, tabelas paginadas e drill-down — trazendo transparência e confiança nos dados.

## Abordagem

### 1. Página dedicada `MiningDataExplorer`

Nova página `/marketing/mining-data` com abas para cada tipo de dado:

- **Influenciadores**: Tabela com username, plataforma, seguidores, engagement, composite_score, rank, status. Filtros por plataforma e faixa de score.
- **Posts**: Tabela com influenciador, tipo (video/image/carousel), likes, comentários, shares, data. Filtro por influenciador e tipo.
- **Comentários**: Tabela com texto, autor, sentimento (badge colorido), sentiment_score, is_spam. Filtros por sentimento e influenciador.
- **Análises IA**: Tabela com influenciador, tipo de análise, modelo IA, data. Clique para expandir o JSON `result` formatado em cards legíveis.
- **Oportunidades**: Tabela com título, tipo, score, status (new/viewed), descrição completa.

### 2. Componente `MiningDataExplorer.tsx`

- Usa `Tabs` com 5 abas (Influenciadores, Posts, Comentários, Análises, Oportunidades)
- Cada aba tem:
  - Filtros inline (Select + Input)
  - Tabela com `Table` do shadcn, paginação manual (20 por página)
  - Contadores totais
  - Export CSV (botão simples que gera download)
- Para Análises: drawer/dialog que renderiza o JSONB `result` de forma visual (cards com scores, textos formatados)

### 3. Botão de acesso no `AutopilotMiningPanel`

- Adicionar botão "Ver Detalhes" no header do painel que navega para a nova página
- Link direto usando `useNavigate`

### 4. Rota

- Adicionar rota `/marketing/mining-data` no router apontando para a nova página

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/MiningDataExplorer.tsx` | Criar — página com 5 abas de detalhamento |
| `src/components/marketing/influencers/AutopilotMiningPanel.tsx` | Modificar — adicionar botão "Ver Detalhes" |
| `src/App.tsx` | Modificar — adicionar rota `/marketing/mining-data` |

