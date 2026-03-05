

## Painel Administrativo do Calendário — Metas, Regras e Planos de Ação

### Conceito

Ao clicar em um dia no calendário (ou selecionar um período como mês/trimestre), abre-se um **Painel Lateral de Análise** que funciona como centro de comando administrativo. Nele o gestor pode:

1. **Ver análise do período** — KPIs automáticos (tarefas concluídas, atrasadas, taxa de conclusão, velocidade)
2. **Configurar regras de metas** — Definir metas por período (ex: "80% das tarefas concluídas no mês", "máximo 3 tarefas atrasadas por semana")
3. **Criar planos de ação** — Registrar ações corretivas vinculadas ao período/dia selecionado

```text
┌─ Calendário ────────────────────┐ ┌─ Painel de Análise ──────────┐
│                                 │ │ 📅 Março 2026                │
│   ◀ Março 2026 ▶  [Mês][Sem]   │ │                              │
│ ┌───┬───┬───┬───┬───┬───┬───┐  │ │ ── KPIs ──                   │
│ │   │   │ 1 │ 2 │ 3 │   │   │  │ │ ✅ 12/20 concluídas (60%)   │
│ │   │   │●T1│   │●T2│   │   │  │ │ ⚠️ 3 atrasadas              │
│ ├───┼───┼───┼───┼───┼───┼───┤  │ │ 📊 Vel: 4.2 tarefas/semana  │
│ │ 6 │ 7 │ 8 │...│   │   │   │  │ │                              │
│ │●T4│   │   │   │   │   │   │  │ │ ── Regras de Metas ──        │
│ └───┴───┴───┴───┴───┴───┴───┘  │ │ [+] Nova regra               │
│                                 │ │ • ≥80% conclusão ✅ OK       │
│                                 │ │ • ≤2 atrasadas ❌ Violada    │
│                                 │ │                              │
│                                 │ │ ── Planos de Ação ──         │
│                                 │ │ [+] Novo plano               │
│                                 │ │ • Realocar equipe Criação    │
│                                 │ │   Status: Em andamento       │
└─────────────────────────────────┘ └──────────────────────────────┘
```

### Mudanças no Banco de Dados

**Tabela `projeto_calendario_regras`** — Regras de metas configuráveis por projeto:
- `id`, `projeto_id`, `titulo`, `tipo` (percentual_conclusao, max_atrasadas, min_velocity), `operador` (>=, <=, =), `valor` (numeric), `periodo` (mensal, semanal, trimestral), `ativo`, `created_by`, timestamps

**Tabela `projeto_planos_acao`** — Planos de ação vinculados a períodos:
- `id`, `projeto_id`, `titulo`, `descricao`, `data_inicio`, `data_fim`, `status` (pendente, em_andamento, concluido, cancelado), `responsavel_id`, `created_by`, timestamps

RLS: Ambas acessíveis apenas por membros autenticados do projeto.

### Mudanças Técnicas

| Ação | Arquivo |
|------|---------|
| Migração | Criar tabelas `projeto_calendario_regras` e `projeto_planos_acao` com RLS |
| Criar | `src/hooks/useProjetoCalendarioRegras.ts` — CRUD de regras de metas |
| Criar | `src/hooks/useProjetoPlanosAcao.ts` — CRUD de planos de ação |
| Criar | `src/components/projetos/CalendarioAnalisePanel.tsx` — Painel lateral com 3 seções: KPIs, Regras, Planos de Ação |
| Editar | `src/components/projetos/ProjetoCalendarioView.tsx` — Adicionar seleção de período (dia/mês/trimestre), botão "Análise", e renderizar o painel lateral |

### Detalhes do Painel

**Seção KPIs** (calculados automaticamente a partir das tarefas do período):
- Total de tarefas, concluídas, atrasadas, em risco, taxa de conclusão (%), velocidade (tarefas/semana)
- Barras de progresso visuais

**Seção Regras de Metas**:
- Lista de regras ativas com badge de status (✅ Cumprida / ❌ Violada) calculado em tempo real
- Dialog para criar/editar regra com campos: título, tipo de métrica, operador, valor alvo, período
- Toggle para ativar/desativar regra

**Seção Planos de Ação**:
- Lista de planos com status colorido
- Dialog para criar plano com título, descrição, responsável, datas
- Transição de status inline

Suporte completo ao `darkBg` em todos os componentes.

