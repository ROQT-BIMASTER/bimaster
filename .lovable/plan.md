

## Plano: Painel Expandido de Performance Individual (estilo Focus Mode)

Substituir o modal atual por um **Dialog fullscreen** (98vw x 95vh) no estilo do `TarefaFocusMode`, com layout em colunas e detalhes reais das tarefas do membro.

### Layout

```text
┌──────────────────────────────────────────────────────────────────┐
│ [Avatar] Nome · Badge Cargo · Score 42pts        [Sair do Foco] │
├────────────────────────────────┬─────────────────────────────────┤
│  COLUNA ESQUERDA               │  COLUNA DIREITA                │
│                                │                                │
│  ▸ KPIs (grid 2x2)            │  ▸ Lista de Tarefas            │
│    Proj. Ativos | Total Taref  │    ┌─ Tarefa 1 ── prazo ── ●  │
│    Concluídas   | Atrasadas    │    ├─ Tarefa 2 ── prazo ── ○  │
│                                │    ├─ Tarefa 3 ── ATRASADA ─!  │
│  ▸ Taxa de Conclusão           │    └─ Tarefa 4 ── prazo ── ●  │
│    [████████░░] 75%            │                                │
│                                │  Filtros: Todas | Pendentes    │
│  ▸ Score de Produtividade      │           Concluídas | Atrasa. │
│    Card destaque amber         │                                │
│                                │  Cada tarefa mostra:           │
│  ▸ Ranking na Equipe           │  - Título + código             │
│    Mini lista top 5            │  - Projeto (nome)              │
│                                │  - Status badge                │
│                                │  - Data prazo + risk badge     │
│                                │  - Prioridade                  │
└────────────────────────────────┴─────────────────────────────────┘
```

### Implementação

**Arquivo:** `src/pages/ProjetosMinhaEquipe.tsx`

1. **Dialog fullscreen**: Mudar de `max-w-4xl` para `max-w-[98vw] w-[98vw] h-[95vh]` com `flex flex-col overflow-hidden` (mesmo estilo do `TarefaFocusMode`)

2. **Header compacto**: Avatar + nome + badge de cargo + score em linha horizontal, botão "Sair do Foco" à direita (com ícone `Minimize2`)

3. **Layout 2 colunas** (`flex flex-1 overflow-hidden`):
   - **Coluna esquerda** (ScrollArea, ~40%): KPIs em grid 2x2, taxa de conclusão com Progress bar, score card amber, ranking mini-lista (conteúdo já existente, reorganizado)
   - **Coluna direita** (ScrollArea, ~60%): **Lista real das tarefas do membro** buscadas do banco

4. **Busca de tarefas do membro**: Nova query dentro do componente que busca `projeto_tarefas` filtradas por `responsavel_id = member.id`, incluindo join com `projetos` para nome do projeto. Exibir em tabela/lista com:
   - Título da tarefa + código
   - Nome do projeto
   - Status (badge colorido)
   - Data prazo + `TarefaRiskBadge`
   - Prioridade

5. **Filtro de status**: Tabs ou botões para filtrar "Todas", "Pendentes", "Concluídas", "Atrasadas"

6. **Componente `TarefaRiskBadge`**: já existe, será reutilizado na lista de tarefas

### Dados necessários
- Query adicional: `projeto_tarefas` com `responsavel_id = member.id` + join `projetos(nome)` — executada ao abrir o modal
- Nenhuma migração de banco necessária

