

# Melhorias de Responsividade Mobile — Correções Globais

## Problemas Identificados

### 1. Header do Dashboard — Overflow no Mobile
O header (`DashboardLayout.tsx` linha 97-108) contém 5+ elementos (EmpresaSelector, LanguageSelector, ImpersonationSelector, NotificationBell, logo) todos visíveis sem breakpoints. Em telas < 768px, eles transbordam ou comprimem.

**Correção**: Esconder título do sistema no mobile, reduzir gaps, esconder seletores secundários (Language, Impersonation) em mobile — acessíveis via menu lateral.

### 2. TabsList com grid-cols-5/6/7 — Texto Ilegível no Mobile
26+ componentes usam `TabsList grid w-full grid-cols-5` ou mais. Em 360px, cada tab tem ~72px — texto fica cortado e ilegível.

**Correção**: Criar componente wrapper `ScrollableTabsList` que no mobile usa `flex overflow-x-auto` em vez de `grid`, permitindo scroll horizontal nas tabs. Aplicar nos 6 piores ofensores (SocialMediaMonitoring, WhatsAppMonitoring, configurações, etc).

### 3. Kanban de Prospects — 6 Colunas no Mobile
`KanbanBoard.tsx` usa `xl:grid-cols-6` mas no mobile fica `grid-cols-1` — OK, mas sem indicação visual de scroll entre colunas.

**Correção**: No mobile, adicionar scroll horizontal com snap-to-column em vez de empilhar verticalmente (que fica muito longo).

### 4. Chat — Ambos Painéis Visíveis no Mobile
`Chat.tsx` mostra lista + janela simultaneamente (`grid-cols-1 md:grid-cols-3`). No mobile, a lista e janela ficam empilhados, desperdiçando espaço.

**Correção**: No mobile, mostrar apenas lista OU janela (com botão voltar).

### 5. Títulos h2 text-3xl — Muito Grandes no Mobile
183+ páginas usam `text-3xl font-bold` para títulos. Em 360px, ocupam muito espaço vertical.

**Correção**: Usar `text-xl sm:text-3xl` nos componentes de header reutilizáveis (`PageHeader`).

### 6. KPI Grids — Comprimidos no Mobile
Muitas páginas usam `grid-cols-2 md:grid-cols-4` para KPIs. Em 320px, 2 colunas ficam apertadas.

**Correção**: Garantir `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` nos principais dashboards.

## Plano de Implementação

### 1. Header Mobile Responsivo (`DashboardLayout.tsx`)
- Esconder `h1` (título do sistema) no mobile (`hidden sm:block`)
- Esconder `LanguageSelector` e `ImpersonationSelector` no mobile
- Reduzir logo para `h-8` no mobile
- Reduzir gap para `gap-2`

### 2. ScrollableTabsList Wrapper (`src/components/ui/scrollable-tabs.tsx`)
- Componente que renderiza `TabsList` com `overflow-x-auto flex` no mobile
- Aplicar em: `SocialMediaMonitoring`, `WhatsAppMonitoring`, `InadimplenteDrawerPro`, `DocumentacaoIntegracaoERP`, `ContasReceberSyncPage`, `TradeVisits`

### 3. Chat Mobile com Toggle (`Chat.tsx`)
- Usar `useIsMobile()` para alternar entre lista/janela
- Botão "Voltar" na janela de chat

### 4. PageHeader Responsivo
- Ajustar `text-3xl` → `text-xl sm:text-3xl` no componente `PageHeader`

### 5. Kanban Horizontal no Mobile
- `KanbanBoard.tsx`: no mobile usar `flex overflow-x-auto snap-x` em vez de grid empilhado

## Alterações Técnicas

| Arquivo | Ação |
|---------|------|
| `DashboardLayout.tsx` | Header responsivo: esconder elementos secundários no mobile |
| `src/components/ui/scrollable-tabs.tsx` | Novo componente wrapper para tabs scrolláveis |
| `SocialMediaMonitoring.tsx` + 5 outros | Trocar TabsList por ScrollableTabsList |
| `Chat.tsx` | Toggle lista/janela no mobile |
| `src/components/ui/page-header.tsx` | Título responsivo |
| `KanbanBoard.tsx` | Scroll horizontal no mobile |

Zero migrations. Apenas CSS/layout responsivo.

