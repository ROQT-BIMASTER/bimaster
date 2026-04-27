## Objetivo
Alinhar **100% da identidade visual** da nova **Caixa de Entrada global** (`InboxDrawer`) e das **Centrais por módulo** (`CentralTrabalhoModulo` + páginas `CentralAprovacoes`, `CentralMotorArtes`, `CentralComposicao`, `CentralEmbalagens`, `CentralAmostras`) ao padrão visual já consolidado do módulo **Projetos / Central de Trabalho**.

**Sem alterar nenhuma funcionalidade existente.** Nenhuma rota, hook, mutation, RPC, atalho, filtro, regra de leitura, ação em lote ou contagem será modificada — apenas a camada de apresentação (componentes, classes Tailwind, ícones, espaçamentos, tipografia).

---

## Padrão visual de Projetos a ser replicado

A leitura dos arquivos de referência (`CentralHeader.tsx`, `CentralKPIs.tsx`, `ProjetoInboxFeed.tsx`, `ProjetoInboxCard.tsx`, `ProjetoHomeKPIs.tsx`, `kpi-card.tsx`, `card.tsx`) revelou os seguintes padrões reutilizáveis:

1. **Header da página** (estilo CentralHeader)
   - Saudação contextual + `LayoutDashboard`/ícone do módulo em `text-primary`
   - `text-2xl font-bold`, data por extenso em `text-xs text-muted-foreground capitalize`
   - `SidebarTrigger` à esquerda, ações alinhadas à direita com `Button size="sm" variant="outline" gap-1.5`
2. **Faixa de KPIs** (estilo `CentralKPIs`)
   - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`
   - Componente compartilhado `<KpiCard />` com variantes semânticas (`info`, `warning`, `destructive`, `success`)
   - Suporte a `loading` (skeleton interno), `subtitle` e `onClick` para drilldown
3. **Cards de conteúdo** (estilo `Card` global)
   - `rounded-[10px] border border-border bg-card`, sombra suave + leve `-translate-y-[1px]` em hover
   - Títulos em `font-display`
4. **Itens de lista da Inbox** (estilo `ProjetoInboxCard`)
   - Barra colorida vertical `w-[3px]` à esquerda (cor da origem)
   - Bolinha de não-lido `bg-primary animate-pulse`, ícone de tipo em pílula colorida `bg-{color}/15 text-{color}`
   - Avatar 7×7, ações rápidas `opacity-0 group-hover:opacity-100`
   - Linha por seção com label `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` em barra `bg-muted/20`
5. **Estados vazios e loading**
   - `<EmptyState icon={...} title="..." description="..." />` (já existe em `src/components/ui/empty-state.tsx`)
   - Skeletons reais (não “Carregando…” em texto)

---

## Mudanças propostas (apenas visuais)

### 1. `src/components/inbox/CentralTrabalhoModulo.tsx` — Visual refinado

- **Header do módulo** trocado pelo padrão de `CentralHeader`:
  - `SidebarTrigger` + ícone do módulo em pill colorido (`bg-{cor}/15 text-{cor}`) **mantendo** o `corModulo` recebido por props
  - Subtítulo em `text-xs text-muted-foreground`, título `text-2xl font-bold font-display`
  - Botões "Atalhos" e "Abrir Caixa de Entrada global" no mesmo estilo dos botões do `CentralHeader` (size `sm`, `variant="outline"`, `gap-1.5`)
- **KPIs do módulo** trocando o `KpiCard` ad-hoc local pelo `<KpiCard />` compartilhado de `@/components/ui/kpi-card`:
  - Mapear `acao_minha → variant="info"`, `atribuida_a_mim → variant="default"`, `acompanho → variant="accent"`, `delegada_por_mim → variant="warning"`
  - Usar `onClick` para trocar a aba (mantém comportamento atual)
  - Usar `loading={isLoading}` no lugar do estado “Carregando...”
- **Lista de itens** ganha o look do `ProjetoInboxCard`:
  - Barra colorida lateral `w-[3px]` usando `corModulo`
  - Bolinha pulsante para não-lidos
  - Pílula de tipo com cor semântica (mesmo mapeamento usado no `InboxDrawer`)
  - Pílula do nome do módulo no rodapé do item
  - Hover com `bg-muted/40`, seleção com `bg-primary/10` e `ring-1 ring-primary/30`
- **Estados vazios** trocados por `<EmptyState />` (mesmo componente que `ProjetoInboxFeed` já usa)
- **Loading** trocado por skeleton no estilo de `ProjetoInboxFeed` (`FeedSkeleton`)
- **Card externo** com classes do `Card` padrão (sombra suave + `font-display` no título)
- **Tabs** alinhadas ao mesmo visual já usado em `CentralTrabalho.tsx` (já usa shadcn `TabsList`, só ajustar espaçamento e ícones inline)

### 2. `src/components/inbox/InboxDrawer.tsx` — Linguagem visual de Projetos

- **Coluna 1 (Caixas)**: bullets com mesma cor/estilo da sidebar de Projetos:
  - Itens ativos com `bg-primary/10 text-primary font-medium border-l-2 border-primary`
  - Spacing/typography idênticos aos do menu lateral
  - Seção "Origens" como chips coloridos (não TabsList) usando o mesmo mapa `ORIGEM_META` já existente — pílulas `rounded-full` com `bg-{color}/10 text-{color}` e `ring-1` quando ativas (mesmo padrão do `ProjetoInboxCard.projeto_nome`)
- **Coluna 2 (Lista)**:
  - Barra colorida vertical `w-[3px]` à esquerda (já existe — manter)
  - Pílula da origem em maiúsculo (uppercase tracking-wider) já está OK, apenas refinar tamanho/espaçamento para casar com `ProjetoInboxCard`
  - Substituir “Carregando…” por skeleton equivalente ao `FeedSkeleton`
  - Substituir empty por `<EmptyState />`
  - Cabeçalho "Não lidas / Buscar" ganha mesma altura/typography do toolbar de Projetos
- **Coluna 3 (Preview)**:
  - Header do item com `font-display`, badge de origem colorida (já existe — só padronizar paddings)
  - Botões CTA com `gap-1.5` igual `CentralHeader`
  - Seção "Metadata" com mesmo `bg-muted/30 rounded px-2 py-1 border-l-2` usado em comentários do `ProjetoInboxCard`
- **Header do drawer**: ícone `Inbox` em pílula `bg-primary/10`, título em `font-display font-semibold`, kbd hints alinhados à direita (já existem — só ajustar tamanho)

### 3. Páginas de cada Central (`CentralAprovacoes.tsx`, `CentralMotorArtes.tsx`, `CentralComposicao.tsx`, `CentralEmbalagens.tsx`, `CentralAmostras.tsx`)

- **Sem mudança estrutural** — continuam montando `<CentralTrabalhoModulo />`
- Apenas garantir que cada uma passe um `corModulo` em **HSL token-friendly** consistente com a paleta do projeto e que o ícone passado para `Icon` siga a convenção `text-primary` quando renderizado
- Nenhuma rota, prop nova ou lógica adicional

### 4. Pequenos polimentos transversais

- Garantir uso de `font-display` nos títulos de header (já há a font carregada — `card.tsx` usa `font-display` no `CardTitle`)
- Substituir todos os `text-warning` literais por classes semânticas existentes
- Padronizar paddings: cards `p-4`, headers internos `px-4 py-3`, listas `px-2.5 py-2.5` (mesmos valores do `ProjetoInboxCard`)
- Animações: usar `animate-fade-in` por item (já existe e é usado em `ProjetoInboxFeed`)

---

## O que **NÃO** muda (garantia explícita)

- Estrutura de dados (`inbox_items`, RPCs, triggers SQL)
- Hook `useInbox`, contagens, filtros, snooze, favoritos, bulk actions
- Atalhos de teclado (`i`, `j`, `k`, `e`, `?`)
- Modal de atalhos (`ShortcutsDialog`) — apenas refinamento tipográfico
- Rotas (`/dashboard/central/...`), entradas na sidebar e badge de contagem
- Comportamento híbrido `auto`/`acao` de leitura
- Notificação no sino (já harmonizado)

---

## Arquivos que serão editados

- `src/components/inbox/CentralTrabalhoModulo.tsx` (visual refinement, troca de KpiCard local pelo compartilhado, EmptyState/Skeleton, item style)
- `src/components/inbox/InboxDrawer.tsx` (chips de origem, EmptyState/Skeleton, padronização de spacing e tipografia)

Nenhum arquivo novo será criado e nenhum arquivo de lógica (hooks, contextos, migrations) será tocado.

---

## Resultado esperado

A Caixa de Entrada global e cada Central por módulo passam a parecer **filhas naturais do módulo Projetos** — mesma tipografia, mesmos KPIs, mesmas pílulas coloridas, mesmos estados vazios/loading, mesma respiração e densidade — preservando 100% das funcionalidades já implementadas e dos atalhos/contagens já validados.
