

## Calendário Profissional para Projetos

### Conceito

Criar uma nova aba **"Calendário"** no módulo de projetos — uma visão mensal/semanal estilo Google Calendar, complementar ao Cronograma (Gantt). O calendário mostra tarefas posicionadas nas células dos seus **prazos (data_prazo)**, com indicadores visuais de status, prioridade e responsável. Diferente do Gantt que foca em duração/barras, o calendário foca em **datas-chave e visão rápida do mês**.

### Layout

```text
┌─────────────────────────────────────────────────────┐
│  ◀  Março 2026  ▶    [Mês] [Semana]    🔍 Filtrar  │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│ Seg  │ Ter  │ Qua  │ Qui  │ Sex  │ Sáb  │ Dom      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│      │      │  1   │  2   │  3   │  4   │  5       │
│      │      │ ●T1  │      │ ●T2  │      │          │
│      │      │ ●T3  │      │      │      │          │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│  6   │  7   │  ...                                  │
│ ●T4  │      │                                       │
│+2more│      │                                       │
└──────┴──────┴───────────────────────────────────────┘
```

### Funcionalidades

1. **Visão Mensal** — Grade 7 colunas × 5-6 semanas. Cada célula mostra até 3 tarefas + badge "+N mais"
2. **Visão Semanal** — 7 colunas com mais espaço vertical, mostrando todas as tarefas do dia
3. **Cartão de tarefa** — Pill colorida pelo estágio, com ícone de status (●), nome truncado, avatar do responsável
4. **Navegação** — Botões ◀ ▶ para mês/semana anterior/próximo, botão "Hoje" para voltar ao presente
5. **Marcador de Hoje** — Célula do dia atual com destaque (borda/fundo diferenciado)
6. **Filtros** — Reutiliza filtros de seção e status já existentes no cronograma
7. **Dark mode** — Respeita prop `darkBg` com contraste automático (branco sobre preto)
8. **Click na tarefa** — Abre o painel de detalhe lateral (ProjetoTarefaDetalhe) existente

### Mudanças Técnicas

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/components/projetos/ProjetoCalendarioView.tsx` | Componente principal com grade mensal/semanal, navegação, filtros, e renderização de tarefas por data_prazo |
| Editar | `src/pages/ProjetoDetalhe.tsx` | Adicionar aba "calendario" e renderizar `ProjetoCalendarioView` |
| Editar | `src/components/projetos/ProjetoHeader.tsx` | Adicionar tab "Calendário" com ícone CalendarDays entre Cronograma e Painel |

### Detalhes do componente `ProjetoCalendarioView`

- Usa `useProjetoTarefas(projetoId)` para dados (mesmo hook das outras views)
- Agrupa tarefas por `data_prazo` usando `getDateKey()` do `dateUtils.ts`
- Grade construída com `eachDayOfInterval` do date-fns para o mês/semana atual
- Estado local: `currentDate` (mês navegado), `viewMode` ("month" | "week"), filtros de seção/status
- Cada task pill usa cores de estágio existentes (`ESTAGIO_COLORS`) e ícones de status
- Célula com mais de 3 tarefas mostra "+N" com popover listando todas
- Suporte completo a `darkBg`: células `bg-white/5`, textos `text-white`, bordas `border-white/10`

