## Objetivo

Permitir que o usuário organize a tela de Influenciadores em **painéis nomeados** (workspaces), cada um com seu próprio conjunto de filtros — por marca, nicho de conteúdo, busca textual ou faixas numéricas — mantendo o dashboard e seus componentes atuais intactos.

## Conceito de UX

Acima dos KPIs, uma faixa de **abas de painéis** estilo navegador:

```text
[ Geral ] [ Skincare SP ] [ Marca Ruby Rose ] [ Top Beauty BR ] [ + Novo painel ]   [ ⚙ ]
```

- **Geral** é fixo e equivale ao comportamento atual (sem filtros salvos).
- Cada painel guarda: nome, ícone/cor, descrição opcional e os filtros aplicados.
- Ao clicar numa aba, o dashboard reaplica os filtros e o título do painel aparece no header.
- Botão **+ Novo painel** abre um diálogo "Criar painel" com os filtros atuais pré-preenchidos (one-click "salvar como painel").
- Ícone **⚙** abre um drawer **Gerenciar painéis** (renomear, duplicar, excluir, compartilhar, reordenar).

Indicador visual no card do painel ativo: badge de escopo (Pessoal / Compartilhado), contagem de influenciadores que batem com o filtro e data da última edição.

## Critérios de filtro suportados

Cada painel persiste um JSON de filtros com:

- **Marca / cliente** — nova tag `marca` em `influencers` (texto livre + autocomplete pelo histórico).
- **Perfil de conteúdo / nicho** — campo `nicho` (beleza, fitness, lifestyle, moda, etc.), preenchível manualmente ou sugerido pela IA já existente (`influencer-autopilot`).
- **Busca textual avançada** — termos em username, display_name, bio e captions; suporte a múltiplos termos com lógica AND.
- **Faixas numéricas** — sliders para seguidores, engajamento, score composto e fraud score.
- Filtros já existentes (plataforma, região, UF) continuam funcionando e ficam embutidos no painel.

## Escopo (híbrido)

- Cada painel nasce **Pessoal** (visível só ao criador).
- Toggle "Compartilhar com a equipe" no diálogo de edição → painel passa a aparecer para todos os usuários do módulo Marketing, com o nome do criador visível.
- Apenas o criador (ou admin) pode editar/excluir um painel compartilhado; demais usuários podem **duplicar** para criar a sua própria versão.

## Arquitetura técnica

### Banco de dados

Nova tabela `influencer_paineis`:

- `id`, `user_id` (criador), `nome`, `descricao`, `cor` (hex), `icone` (lucide), `compartilhado` (bool), `ordem` (int), `filtros` (jsonb), timestamps.
- RLS:
  - SELECT: criador OU `compartilhado = true`.
  - INSERT: `user_id = auth.uid()`.
  - UPDATE/DELETE: criador OU admin.
- Índices: `(user_id)`, `(compartilhado) WHERE compartilhado = true`.

Acréscimos em `influencers` (não destrutivos):
- `marca` text (nullable) — tag opcional.
- `nicho` text (nullable) — categoria temática.
- Índices simples em ambos.

Trigger leve para preencher `nicho` automaticamente quando o autopilot rodar (reaproveita o existente `influencer-autopilot`, sem mudança de contrato).

### Frontend

Novo subdiretório `src/components/marketing/influencers/paineis/`:

- `PaineisTabs.tsx` — barra de abas no topo do `InfluencerDashboard`.
- `PainelDialog.tsx` — criar/editar (nome, cor, ícone, escopo, filtros).
- `PainelManagerDrawer.tsx` — listar, reordenar (drag), duplicar, excluir, compartilhar.
- `usePaineisInfluencers.ts` — hook React Query (lista, mutations, painel ativo via `localStorage` por usuário).
- `painelFilters.ts` — utilitário puro: aplica um JSON de filtros sobre o array já carregado de influenciadores.

Refator mínimo em `InfluencerDashboard.tsx`:
- Estado `painelAtivo` controla os filtros aplicados; os filtros locais (busca, plataforma, região, UF) continuam editáveis e ficam "por cima" do painel — botão "Salvar alterações no painel" aparece quando há divergência.
- Painel "Geral" = comportamento atual (sem filtros salvos), garantindo zero regressão para quem não usar o recurso.

### Permissões

- Reaproveita a permissão de tela `marketing_social` (Influenciadores). Sem novos códigos de tela.
- Painéis compartilhados usam a flag, sem depender do sistema de departamentos.

## Entregáveis

1. Migração SQL (tabela + colunas + RLS + índices).
2. Hook + 3 componentes da pasta `paineis/`.
3. Integração no `InfluencerDashboard.tsx` (faixa de abas + estado do painel ativo).
4. Painel "Geral" pré-existente garantido por seed/local.

## Não-objetivos (fora do escopo desta entrega)

- Compartilhamento granular por usuário/grupo.
- Dashboards completamente diferentes por painel (continua sendo o mesmo dashboard com filtros).
- Notificações por painel.
- Mover os outros componentes (AIOpportunities, ContentIntelligence, etc.) para "abaixo do painel ativo" — fica como evolução futura caso desejem KPIs por painel.

## Riscos e mitigação

- **Risco:** confusão entre filtros do painel salvo e filtros locais. **Mitigação:** badge "modificado" + botão explícito "Salvar no painel" / "Restaurar do painel".
- **Risco:** painéis compartilhados poluindo a barra. **Mitigação:** dropdown "Painéis da equipe" separado das abas pessoais quando passar de N=5.
- **Risco:** RLS de leitura pública vazando criadores. **Mitigação:** policy só expõe `user_id` para joins de UI; nome do criador vem por join controlado em `profiles`.
