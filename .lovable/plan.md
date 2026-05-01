## Objetivo

Elevar o padrão visual do módulo Projetos a um nível "Linear/Asana premium", mantendo a cor de fundo do usuário como protagonista (paleta derivada via `getBgPaletteVars`). Sem mudanças de regras de negócio, RLS ou schema — apenas frontend/presentation.

## Escopo

1. **Listagem (`Projetos.tsx`)** — header, KPIs e cards de projeto.
2. **Detalhe** — `ProjetoListView`, `ProjetoKanbanView`, `ProjetoCronogramaView`, `ProjetoCalendarioView`.
3. **Linhas de tarefa** — `ProjetoTarefaRow`, `ProjetoSecao` (densidade, hover, badges).
4. **Filtros** — `ProjetoFilterSort` + chips de filtros ativos + busca rápida com debounce.
5. **Densidade** — toggle compacto/confortável persistido em localStorage por usuário.

## Entregas funcionais (frontend-only)

### 1. Refino visual unificado
- **Header listagem**: hierarquia tipográfica (título 24/semibold, subtítulo muted), espaçamento respirável, botão primary com gradient sutil derivado de `--primary`, search inline com ícone, ações alinhadas à direita.
- **KPIs**: pequena faixa de KPIs no topo da listagem (Total, Em andamento, Atrasados, Concluídos no mês) usando cards translúcidos `bg-card/60 backdrop-blur` para harmonizar com a cor de fundo.
- **Cards de projeto**: borda 1px com `border-border/60`, hover com elevação (`shadow-md` + translate-y -1px), accent-bar lateral derivada do estágio (planejado/executivo/lançamento), barra de progresso mais fina (h-1.5) com cor por status, contadores "X/Y tarefas" + atrasos com micro-badges.
- **Empty states**: ilustração + CTA centralizados, copy mais clara.
- **Skeletons**: `ProjetoSkeletons` revisado para evitar layout shift.

### 2. Listagem de tarefas (densidade)
- Novo hook `useTarefaDensity()` (localStorage `projetos:density` → `comfortable | compact`).
- Toggle no header do detalhe (ícone Rows3/Rows2) ao lado do BgColorPicker.
- `ProjetoTarefaRow` e `ProjetoSecao` recebem prop `density` que ajusta padding (py-2 vs py-1), tamanho de avatar, gap e font-size.
- Hover de linha: `bg-muted/40` + barra esquerda 2px primary; seleção: `bg-primary/10` + barra primary cheia.
- Badges de status/estágio padronizados via `STATUS_COLORS_LIST`/`STATUS_COLORS_LIST_DARK` já existentes em `projetoConstants.ts` — só revisar pílulas para `rounded-full`, `text-[11px]`, padding consistente.

### 3. Kanban / Cronograma / Calendário
- **Kanban**: colunas com header sticky, contador de cards, accent-bar superior por estágio (`ESTAGIO_ACCENT_KANBAN`), card com sombra `shadow-sm` + hover `shadow-md`, drag handle visível em hover.
- **Cronograma**: barras com gradient + bordas arredondadas (rounded-md), grid de dias mais sutil (`border-border/30`), today-line com `bg-primary` + label.
- **Calendário**: pílulas de tarefa com truncate inteligente, hover popover com resumo, dias do mês atual destacados.

### 4. Filtros rápidos + chips ativos
- `ProjetoFilterSort`: adicionar barra de **chips de filtros ativos** abaixo (status, estágio, responsável, busca) com X para remover individualmente e "Limpar tudo".
- **Busca rápida**: input já existe; adicionar debounce 200ms e atalho `/` para focar (sem conflitar com Cmd+K global).
- **Persistência**: filtros salvos em `localStorage` por projeto (`projetos:filters:${projetoId}`).

### 5. Identidade derivada da paleta
- Cards/painéis usam `bg-card/70 backdrop-blur-sm` para harmonizar com qualquer cor de fundo.
- Accents (barras laterais, ícones de KPI, progress) usam `hsl(var(--primary))` que já é recalculado por `getBgPaletteVars`.
- Sombras com `--shadow-elegant` token (criar em `index.css` se não existir).

## Detalhes técnicos

**Arquivos a editar (frontend, sem backend):**

| Arquivo | Mudança |
|---|---|
| `src/pages/Projetos.tsx` | Header + KPI strip + grid de cards refinado |
| `src/index.css` | Tokens novos: `--shadow-elegant`, `--shadow-card-hover`, `--gradient-primary-subtle` |
| `src/components/projetos/ProjetoHeader.tsx` | Adicionar toggle de densidade ao lado do BgColorPicker |
| `src/components/projetos/ProjetoListView.tsx` | Passar `density` prop, refinar header de seção |
| `src/components/projetos/ProjetoSecao.tsx` | Suporte a densidade + accent bar por status |
| `src/components/projetos/ProjetoTarefaRow.tsx` | Densidade + hover states + badges padronizados |
| `src/components/projetos/ProjetoKanbanView.tsx` | Header sticky + accent bar + sombras |
| `src/components/projetos/ProjetoCronogramaView.tsx` | Gradient nas barras + grid sutil |
| `src/components/projetos/ProjetoCalendarioView.tsx` | Pílulas refinadas + dia atual |
| `src/components/projetos/ProjetoFilterSort.tsx` | Chips ativos + debounce na busca + atalho `/` |
| `src/components/projetos/ProjetoSkeletons.tsx` | Skeletons sem layout shift |

**Arquivos novos:**

| Arquivo | Função |
|---|---|
| `src/hooks/useTarefaDensity.ts` | Hook persistido `comfortable|compact` |
| `src/components/projetos/ProjetoDensityToggle.tsx` | Botão de toggle com ícones Rows3/Rows2 |
| `src/components/projetos/ProjetoActiveFiltersBar.tsx` | Chips de filtros ativos |
| `src/components/projetos/ProjetoKpiStrip.tsx` | Faixa de 4 KPIs no topo da listagem |

**Não toca em:** hooks de dados (`useProjetos`, `useTarefas`), edge functions, RLS, migrations, regras de bloqueio/aprovação, estrutura do briefing, copilot, cofre, asana sync.

## Critérios de aceite

- Listagem em `/dashboard/projetos` mostra KPI strip, cards com accent-bar de estágio e hover elegante.
- Trocar a cor de fundo (BgColorPicker) recolore accents e mantém contraste WCAG-AA.
- Toggle de densidade alterna padding das linhas e persiste entre sessões.
- Chips de filtros ativos aparecem após qualquer filtro/busca; clicar no X remove só aquele filtro.
- Atalho `/` foca a busca; Cmd+K continua funcionando para command palette.
- Kanban/Cronograma/Calendário mantêm comportamento atual com visual refinado.
- Sem regressão de testes existentes (`projetoFilterUtils.test.ts`, `tarefaRiskUtils.test.ts`).
- Build limpo (sem novos warnings TypeScript).

## Fora de escopo

- Mudanças em RLS, schema, edge functions, copilot, briefing IA, sync Asana.
- Novas funcionalidades de negócio (relatórios, automações, etc.).
- Refatorar lógica de cálculo de status/atrasos.
