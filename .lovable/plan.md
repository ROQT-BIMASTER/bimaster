

## Cronograma do Projeto — Plano de Implementação

### Conceito

Um **Gantt Chart interativo** que mostra cada **produto vinculado** como uma linha (swim lane), e dentro de cada linha as **tarefas agrupadas por seção** aparecem como barras horizontais posicionadas pelo prazo. Isso dá visibilidade de todo o ciclo de vida do produto através das seções do projeto.

```text
Produto A  │ ▓▓▓ Briefing ▓▓▓│░░ Criação ░░│▒▒ Revisão ▒▒│■■ Aprovação ■■│
Produto B  │ ▓▓ Briefing ▓▓  │░░░ Criação ░░░│            │▒▒▒ Aprovação ▒▒▒│
Sem produto│ ▓ Tarefa avulsa ▓│                                              │
           └──────────────────┴──────────────┴──────────────┴─────────────────┘
            Mar 10            Mar 17          Mar 24          Mar 31
```

### Funcionalidades

1. **Eixo Y = Produtos** — Cada produto vinculado (via `projeto_tarefa_produtos`) é uma swim lane. Tarefas sem produto ficam em "Geral".

2. **Barras = Tarefas** — Cada barra representa uma tarefa, colorida pela seção. A largura vai de `created_at` até `data_prazo` (ou largura fixa se sem prazo).

3. **Estágios visuais** — A cor/padrão da barra reflete o estágio atual (briefing, criação, revisão, etc.).

4. **Marcador "Hoje"** — Linha vertical vermelha no dia atual.

5. **Interação** — Clicar na barra abre o `ProjetoTarefaDetalhe`. Tooltip com título, responsável e status.

6. **Zoom** — Controle de zoom (semana/mês/trimestre) reutilizando o padrão do `LaunchTimeline`.

7. **Filtros** — Filtrar por seção, status, prioridade.

### Implementação Técnica

**Novo componente**: `src/components/projetos/ProjetoCronogramaView.tsx`

- Recebe `projetoId`
- Usa `useProjetoTarefas` para obter seções e tarefas
- Busca produtos vinculados via `projeto_tarefa_produtos` para agrupar
- Renderiza um Gantt horizontal com:
  - Header de meses/semanas (similar ao `LaunchTimeline`)
  - Swim lanes por produto
  - Barras posicionadas por data

**Atualizar**: `src/pages/ProjetoDetalhe.tsx` — substituir o placeholder "Em breve" pelo novo componente.

**Sem alterações de banco** — usa dados existentes (`projeto_tarefas.data_prazo`, `projeto_tarefa_produtos`, `projeto_secoes`).

### Componentes reutilizados
- Zoom/navegação temporal do `LaunchTimeline`
- `ProductThumbnail` para as swim lanes
- `ProjetoTarefaDetalhe` ao clicar nas barras
- Cores de estágio/status já definidas no projeto

