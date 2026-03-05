

## Modo Foco com Gráfico de Evolução

### O que será feito

Adicionar um **Modo Foco** na tela de detalhes da tarefa (Sheet) que expande para um Dialog full-screen (98vw × 95vh) com:

1. **Layout de 2 colunas**: Detalhes da tarefa à esquerda (60%) + Chat ativo à direita (40%)
2. **Gráfico de Evolução** na coluna esquerda, mostrando:
   - Progresso de marcos/metas ao longo do tempo (datas de conclusão)
   - Atividade da tarefa: comentários e mensagens por dia
   - Linha do tempo visual de status/estágio

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ● Concluída  [HB-L6532]                            [⊟ Sair Foco] │
├─────────────────────────────────────────┬────────────────────────────┤
│  Campos (status, prioridade, estágio…)  │  💬 Chat                  │
│                                         │  ┌────────────────────┐   │
│  📊 Evolução da Tarefa                  │  │ João: Revisado ✓   │   │
│  ┌─────────────────────────────────┐    │  │ Ana: aprovado      │   │
│  │ ▓▓▓▓▓ marcos concluídos        │    │  │                    │   │
│  │ ───── atividade (msgs+comments) │    │  │                    │   │
│  └─────────────────────────────────┘    │  └────────────────────┘   │
│                                         │  ┌────────────┐ [Send]   │
│  Marcos · Descrição · Subtarefas        │  │ Digite...  │          │
│  Anexos · Comentários                   │  └────────────┘          │
└─────────────────────────────────────────┴────────────────────────────┘
```

### Mudanças Técnicas

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Editar | `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Adicionar estado `focusMode`, botão `Maximize2` na top bar, Dialog full-screen com layout 2 colunas. Incluir componente `TaskEvolutionChart` inline que renderiza um `AreaChart` (recharts) com dados de marcos concluídos ao longo do tempo + atividade (comentários/mensagens por dia). O conteúdo do Dialog reutiliza as mesmas seções (campos, marcos, subtarefas, descrição, anexos, comentários) com mais espaço. Chat sempre visível na coluna direita. |

### Gráfico de Evolução — Dados

O gráfico será construído a partir de dados já disponíveis no componente:
- **Marcos**: `metas` do `useProjetoTarefaMetas` — cada meta tem `created_at` e `concluida`
- **Atividade**: `comentarios` e `messages` do `useProjetoTarefaDetalhe` — agrupados por dia
- **Subtarefas**: `tarefa.subtarefas` — contagem de concluídas ao longo do tempo

O gráfico usa `ComposedChart` do recharts com:
- `Area` para progresso acumulado de marcos/subtarefas concluídas
- `Bar` para atividade diária (mensagens + comentários)

