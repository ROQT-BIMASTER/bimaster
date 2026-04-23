

# Unificação Projetos: "Central de Trabalho" — Página Inicial + Minhas Tarefas + Caixa de Entrada

## Diagnóstico (na pele do usuário)

As três telas atuais resolvem perguntas muito próximas e isso gera confusão real:

| Tela | Pergunta que responde | Sobreposição |
|---|---|---|
| **Página Inicial** | "Como está meu dia?" | Mostra **a mesma lista** de Minhas Tarefas (mesmo hook `useMinhasTarefas`, mesmo `groupTarefas`) + projetos + atividades recentes |
| **Minhas Tarefas** | "O que eu preciso fazer?" | Lista idêntica à Home, só que com mais filtros e visões (Lista/Quadro/Calendário/Dashboard) |
| **Caixa de Entrada** | "O que aconteceu de novo?" | Feed de notificações isolado, mas é **sobre as mesmas tarefas** que aparecem nas outras duas |

**Resultado:** o usuário não sabe **onde clicar** para uma tarefa específica. Abre Home, vê a tarefa, clica "Ver todas" e cai em Minhas Tarefas vendo o mesmo conteúdo. Vai no Inbox para responder uma menção e perde o contexto da tarefa. Três rotas, três tours, três `usePageBgColor`, três headers com saudação ("Bom dia, {nome}") — redundância pura.

## Solução: uma única **Central de Trabalho** com abas internas

Uma rota canônica `/dashboard/projetos/home` se torna a **Central de Trabalho** com 3 abas internas que reaproveitam 100% do código já existente (zero reescrita das views internas). Cada aba responde a uma pergunta clara:

```text
┌─────────────────────────────────────────────────────────┐
│  Bom dia, {nome}                            [Nova tarefa]│
│  Você tem 12 pendentes · 3 atrasadas · 2 menções        │
│  ─────────────────────────────────────────────────────  │
│  KPIs (compartilhados): Total | Hoje | Atrasadas | Pend.│
│  ─────────────────────────────────────────────────────  │
│  [ Hoje ]  [ Tarefas ]  [ Notificações (3) ]            │
│  ─────────────────────────────────────────────────────  │
│   conteúdo da aba ativa                                 │
└─────────────────────────────────────────────────────────┘
```

### Mapa das abas

| Aba | URL | Conteúdo (reaproveitado) | Pergunta do usuário |
|---|---|---|---|
| **Hoje** (default) | `?tab=hoje` | Saudação + grid 2 colunas: tarefas do dia/atrasadas (esquerda) + Meus Projetos + Atividades recentes (direita). É a Home atual enxugada — **sem duplicar** a lista completa | "Por onde começo agora?" |
| **Tarefas** | `?tab=tarefas` | A página atual `MinhasTarefas` inteira: views Lista/Quadro/Calendário/Dashboard, filtros, busca, bulk actions, painel de detalhe | "Quero gerenciar tudo o que é meu" |
| **Notificações** | `?tab=inbox` | A página atual `ProjetoInbox` inteira: tabs Atividade/Menções/Favoritas/Arquivadas, filtros por tipo, feed | "O que mudou? Quem me chamou?" |

### Por que isso resolve

1. **Rastreabilidade:** uma URL base (`/projetos/home`), três `?tab=` claras. O usuário sempre sabe onde está e como voltar.
2. **Sem duplicação visual:** a aba "Hoje" deixa de mostrar a mesma lista enorme que vive em "Tarefas" — mostra apenas **destaques** (atrasadas + hoje, máximo 8 itens, com link "Ver tudo em Tarefas").
3. **Header único:** uma saudação, uma faixa de KPIs unificados (Total / Hoje / Atrasadas / Não lidas), um seletor de cor de fundo, um botão "Nova Tarefa" sempre visível. Hoje cada tela tem o seu próprio.
4. **Badges nas abas:** "Notificações (3)" mostra o contador de não lidas direto na aba — o usuário vê o status sem precisar clicar.
5. **Sidebar simplificado:** 3 itens viram 1 só ("Central de Trabalho"). Os 2 outros itens viram **deep-links** opcionais ou são removidos.

## Arquitetura técnica (mínima invasão)

### Novos arquivos

| Arquivo | Função |
|---|---|
| `src/pages/CentralTrabalho.tsx` | Página container com header unificado + `Tabs` controladas por `?tab=` |
| `src/components/projetos/central/HojeTab.tsx` | Aba "Hoje" — versão enxuta da Home atual (apenas destaques: atrasadas + hoje, limit 8) |
| `src/components/projetos/central/CentralKPIs.tsx` | 4 KPIs unificados consumindo `useMinhasTarefas` + `useProjetoAtividades` |
| `src/components/projetos/central/CentralHeader.tsx` | Saudação + KPIs + botão Nova Tarefa + cor de fundo |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/MinhasTarefas.tsx` | Extrair o **conteúdo** (sem `SidebarProvider`/`AppSidebar`/header) para `MinhasTarefasContent` exportado, consumido pela aba "Tarefas" da Central. A página antiga vira um wrapper fino que renderiza `<CentralTrabalho defaultTab="tarefas" />` |
| `src/pages/ProjetoInbox.tsx` | Mesmo padrão: extrair `ProjetoInboxContent` e fazer a página virar wrapper |
| `src/pages/ProjetoHome.tsx` | Mesmo padrão: vira wrapper de `<CentralTrabalho defaultTab="hoje" />` |
| `src/App.tsx` | As 3 rotas continuam funcionando (compatibilidade), mas todas montam `CentralTrabalho` com `defaultTab` diferente. Adicionar rota canônica `/dashboard/projetos/central` |
| `src/components/dashboard/AppSidebar.tsx` | Substituir os 3 itens por 1 só: **"Central de Trabalho"** (ícone `LayoutDashboard`). Manter "Meus Projetos" como item separado (essa é uma tela diferente de verdade) |
| `src/components/navigation/command-routes.ts` | Atualizar entradas; rotas antigas viram aliases para `/central?tab=…` |
| `src/components/projetos/home/ProjetoHomeQuickActions.tsx` | Botões "Minhas Tarefas" / "Caixa de Entrada" passam a trocar de aba (não mais navegar para outra rota) |

### Comportamento de URL

- `/dashboard/projetos/home` → renderiza Central, `defaultTab="hoje"` (compat)
- `/dashboard/projetos/minhas-tarefas` → renderiza Central, `defaultTab="tarefas"` (compat)
- `/dashboard/projetos/inbox` → renderiza Central, `defaultTab="inbox"` (compat)
- `/dashboard/projetos/central?tab=tarefas` → URL canônica nova
- Trocar de aba atualiza `?tab=` via `useSearchParams` (sem recarregar)

### Aba "Hoje" — o que muda em relação à Home atual

| Hoje (atual) | Aba "Hoje" (novo) |
|---|---|
| Lista de **todas** as tarefas agrupadas (5 grupos) | Apenas **Atrasadas + Hoje**, máximo 8 itens, com link "Ver todas em Tarefas →" |
| `ProjetoHomeFilters` próprio | Sem filtros (filtros vivem na aba Tarefas) |
| Quick Actions com 4 botões navegando | Removido — header já tem "Nova Tarefa" |
| Saudação + cor de fundo próprios | Removido — vivem no `CentralHeader` |

Resultado: a aba Hoje é genuinamente um **resumo executivo** ("o que faço agora"), não uma cópia da lista completa.

### KPIs unificados (`CentralKPIs`)

| KPI | Fonte | Visível em |
|---|---|---|
| Total pendentes | `useMinhasTarefas` | sempre |
| Para hoje | `useMinhasTarefas` (filtro `data_prazo === today`) | sempre |
| Atrasadas | `useMinhasTarefas` (filtro `data_prazo < today`) | sempre |
| Não lidas | `useProjetoAtividades.naoLidas` | sempre |

Cada KPI é **clicável** e troca para a aba relevante já com filtro pré-aplicado (ex: clicar em "Atrasadas" → aba Tarefas com filtro de atrasadas; clicar em "Não lidas" → aba Notificações).

## Tours

Consolidar `projetoHomeTour`, `minhasTarefasTour`, `projetoInboxTour` em um único `centralTrabalhoTour` com seções por aba. O `TourButton` fica no header da Central e troca os steps conforme a aba ativa.

## Compatibilidade & migração

- **Zero quebra:** todas as rotas antigas continuam funcionando (atendendo links salvos, atalhos do command palette, e-mails de notificação que apontem para essas URLs).
- **Sem mudanças de schema, RLS, edge functions ou APP_VERSION.**
- `usePageBgColor` continua funcionando — passa a usar uma chave única `"central_trabalho"` em vez de 3 chaves separadas.

## Validação pós-entrega

1. Acessar `/projetos/home` → cai na aba **Hoje**, vê resumo de até 8 tarefas (atrasadas + hoje), KPIs no topo.
2. Clicar na aba **Tarefas** → URL vira `?tab=tarefas`, vê a tela completa de Minhas Tarefas (todas as views funcionando: Lista, Quadro, Calendário, Dashboard).
3. Clicar na aba **Notificações** → vê Inbox completo com tabs Atividade/Menções/Favoritas.
4. Clicar no KPI "Atrasadas" do header → troca para aba Tarefas com filtro aplicado.
5. Acessar URL antiga `/projetos/inbox` → carrega a Central já na aba Notificações.
6. Sidebar mostra apenas **"Central de Trabalho"** + "Meus Projetos" no lugar dos 3 itens antigos.
7. Botão "Nova Tarefa" no header funciona em qualquer aba.
8. Trocar de aba não recarrega a página nem perde estado dos filtros das abas Tarefas/Inbox.

## Não-escopo

- Não mexer em "Meus Projetos" (`/dashboard/projetos`) — é uma tela com propósito diferente (lista mestre de projetos).
- Não alterar o painel de detalhe de tarefa nem o `useMinhasTarefas`/`useProjetoAtividades`.
- Não alterar tabela `projeto_tarefas`, RLS, ou notificações no backend.
- Sem persistir a aba ativa por usuário (apenas via URL).

