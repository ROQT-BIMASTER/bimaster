

## Painel de Análise Expandido — Full-Page com Tabelas por Seção e Regras em Tarefas

### Conceito

Transformar o painel lateral estreito (420px) em um **painel full-width** que ocupa a área principal do calendário (não mais um slide-over fixo). O painel terá:

1. **KPIs expandidos** no topo (mesma lógica, layout horizontal maior)
2. **Tabelas por seção** — Para cada seção do projeto, uma mini-tabela colapsável mostrando suas tarefas com status, prazo, responsável, estágio e progresso
3. **Regras de metas** — Agora com tipos adicionais incluindo regras aplicáveis a **tarefas em andamento** (ex: "nenhuma tarefa em andamento há mais de 14 dias", "máximo 5 tarefas simultâneas em andamento")
4. **Planos de ação** — Seção mantida, com mais espaço visual

### Layout

```text
┌─────────────────────────────────────────────────────────────────┐
│  📊 Painel de Análise — Março 2026              [✕ Fechar]     │
├─────────────────────────────────────────────────────────────────┤
│  [Total: 45] [Concluídas: 28 (62%)] [Atrasadas: 3] [Veloc: 7] │
│  ████████████████████░░░░░░░░░ 62%                              │
├─────────────────────────────────────────────────────────────────┤
│  ── Regras de Metas ──                          [+ Nova Regra] │
│  ✅ ≥80% conclusão mensal    ❌ ≤2 atrasadas                   │
│  ✅ Máx 14 dias em andamento ✅ Máx 5 simultâneas              │
├─────────────────────────────────────────────────────────────────┤
│  ▼ Seção: Criação (12 tarefas)                                 │
│  ┌──────────────┬──────────┬──────┬────────┬──────────┐        │
│  │ Tarefa       │ Status   │Prazo │Estágio │Responsável│       │
│  │ Logo final   │●Em and.  │05/03 │Revisão │ JM       │        │
│  │ Banner site  │●Concluída│01/03 │Aprovado│ AS       │        │
│  └──────────────┴──────────┴──────┴────────┴──────────┘        │
│  ▼ Seção: Regulatório (8 tarefas)                              │
│  ┌──────────────┬──────────┬──────┬────────┬──────────┐        │
│  │ ...                                                │        │
├─────────────────────────────────────────────────────────────────┤
│  ── Planos de Ação ──                          [+ Novo Plano]  │
│  • Realocar equipe — Em andamento — 01/03 a 15/03              │
└─────────────────────────────────────────────────────────────────┘
```

### Mudanças Técnicas

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Reescrever | `src/components/projetos/CalendarioAnalisePanel.tsx` | Expandir de 420px slide-over para painel full-width inline. Adicionar seção de tabelas por seção com Collapsible. Adicionar novos tipos de regra para tarefas em andamento (`max_dias_andamento`, `max_simultaneas_andamento`). |
| Editar | `src/components/projetos/ProjetoCalendarioView.tsx` | Em vez de renderizar o painel como overlay fixo, renderizar inline substituindo o grid do calendário quando `showAnalisePanel` é true. |

### Detalhes

**Novos tipos de regra**:
- `max_dias_andamento` — Alerta se alguma tarefa está "em andamento" há mais de N dias
- `max_simultaneas_andamento` — Limita quantidade de tarefas simultâneas em andamento

**Tabelas por seção**:
- Cada seção renderizada com `Collapsible` (aberta por padrão)
- Cabeçalho mostra nome da seção + contagem + mini progress bar
- Colunas: Tarefa (nome completo), Status (badge), Prazo, Estágio (pill colorida), Responsável (avatar + nome)
- Filtrada pelo mesmo período selecionado no calendário

**Dark mode**: Todas as tabelas, headers e badges respeitam `darkBg` com variantes `white/10`, `text-white`.

