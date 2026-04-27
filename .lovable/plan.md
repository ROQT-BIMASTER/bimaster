## Diagnóstico

O cliente reclamou de **visual** e **falta de menu lateral** no módulo Fábrica China. Investigação confirmou:

1. **Nenhuma das 8 páginas China usa `AppSidebar`** — todas renderizam `<div className="min-h-screen bg-background p-4 md:p-8">` isolado, sem `SidebarProvider`/`AppSidebar`. Por isso o menu lateral some ao entrar no módulo.
2. Cabeçalhos usam padrão antigo (botão `ArrowLeft` + ícone redondo + título) — não seguem o `CentralHeader`/padrão Projetos com `SidebarTrigger`.
3. Cards do painel usam cores fixas em classes Tailwind (`bg-primary/5`) — não usam o `<KpiCard />` com variantes semânticas como Projetos.
4. **Não há picker de cor de fundo** (`ProjetoBgColorPicker`) — recurso muito elogiado em Projetos.
5. Comunicação China–Brasil hoje é **fora do sistema** (e-mail/WhatsApp/planilhas). Já existem peças prontas para internalizar: `ChinaChatPanel`, `ChinaInboxDecisoes`, `ChinaRevisaoFeedback`, `ChinaTimeline` — mas estão subutilizadas e sem entrada visível no painel.

**Importante:** nenhuma funcionalidade existente será removida. Trata-se exclusivamente de reorganização visual e exposição de recursos já existentes.

---

## Plano de melhoria — apenas visual + exposição de recursos

### 1. Restaurar menu lateral em todas as páginas China (8 telas)
Envolver cada página no padrão de Projetos:
```tsx
<SidebarProvider>
  <div className="min-h-screen flex w-full bg-background">
    <AppSidebar />
    <main className="flex-1 overflow-auto" style={bgColor ? {...} : undefined}>
      <div className="p-6 w-full space-y-6">
        {/* header com SidebarTrigger */}
      </div>
    </main>
  </div>
</SidebarProvider>
```

Páginas afetadas:
- `ChinaFabrica.tsx` (painel)
- `ChinaNovaSubmissao.tsx`
- `ChinaRecebimentos.tsx`
- `ChinaOrdens.tsx`
- `ChinaOrdemDetalhe.tsx`
- `ChinaSubmissaoDetalhe.tsx`
- `ChinaFichaProduto.tsx`
- `ProjetoVincularChina.tsx`

### 2. Color picker de fundo (igual a Projetos)
Criar `ChinaBgColorPicker.tsx` reaproveitando `ProjetoBgColorPicker` + `getBgPaletteVars`, persistindo a escolha em `localStorage` por usuário (chave `china-bg-color`). Disponível no header de todas as 8 telas — paleta idêntica à de Projetos (16 presets + hex livre, suporte a temas escuros).

### 3. Header padronizado (estilo CentralHeader/Projetos)
Criar `ChinaPageHeader.tsx` reutilizável:
- `SidebarTrigger` à esquerda
- Ícone temático China (Factory) com bg colorido `destructive/10`
- Título bilíngue PT/中文 com `font-display`
- Slot direito para ações (Nova Submissão, Manual, etc.)
- Breadcrumb opcional (Painel › Submissão › Detalhe)

### 4. Painel `ChinaFabrica` modernizado
- Trocar 6 cards atuais por `<KpiCard />` (`info`, `success`, `warning`, `accent`, `destructive`) com a mesma assinatura usada na Central de Trabalho.
- Adicionar 4ª linha com **"Atalhos de Comunicação"**: Inbox de Decisões, Chat com China, Revisões Pendentes, Timeline — cada um abrindo o componente já existente em drawer/dialog.
- Skeleton de carregamento via `<Skeleton />` (hoje aparece vazio).
- Animação `animate-fade-in` cascata nos cards.

### 5. Internalizar comunicação China–Brasil (sem trocar fluxo)
Como hoje a comunicação ocorre em e-mail/WhatsApp/planilhas, expor de forma destacada o que **já existe no código**:
- **`ChinaInboxDecisoes`** — botão fixo no header do painel com badge de pendências.
- **`ChinaChatPanel`** — abrir em drawer lateral (estilo Inbox Drawer) acessível de qualquer tela China via FAB no canto inferior direito.
- **`ChinaTimeline`** — aba "Histórico de comunicação" em `ChinaSubmissaoDetalhe` e `ChinaOrdemDetalhe`.
- **`ChinaRevisaoPanel` / `ChinaRevisaoFeedback`** — chip "Revisão pendente" no card da submissão quando aplicável.

Resultado: o usuário vê dentro do sistema o que hoje precisa procurar no WhatsApp.

### 6. Lista (Recebimentos / Ordens) com padrão "planilha" Projetos
- Layout largura total (remover `max-w-4xl`).
- Linhas com barra vertical de cor (`border-l-[3px]`) por status.
- Pulse/animação de não-lido em itens com pendência.
- `EmptyState` padrão com CTA bilíngue.
- Filtros como chips coloridos (igual `InboxDrawer` recém-refatorado).

### 7. Acessibilidade e detalhes finais
- Tipografia consistente `font-display` em títulos H1/H2.
- Espaçamentos `gap-6`, `p-6` (igual Projetos).
- Badges com contraste otimizado (já é padrão em `STATUS_LABELS`).
- Manter 100% dos textos bilíngues PT/中文 via `<BilingualLabel />`.

---

## Arquivos a editar

**Novos:**
- `src/components/china/ChinaBgColorPicker.tsx` (wrapper do Projetos)
- `src/components/china/ChinaPageHeader.tsx` (header reutilizável)
- `src/components/china/ChinaCommunicationFab.tsx` (FAB chat global)

**Refatorados (visual apenas, sem mexer em lógica):**
- `src/pages/ChinaFabrica.tsx`
- `src/pages/ChinaNovaSubmissao.tsx`
- `src/pages/ChinaRecebimentos.tsx`
- `src/pages/ChinaOrdens.tsx`
- `src/pages/ChinaOrdemDetalhe.tsx`
- `src/pages/ChinaSubmissaoDetalhe.tsx`
- `src/pages/ChinaFichaProduto.tsx`
- `src/pages/ProjetoVincularChina.tsx`

---

## Garantias

- ✅ Nenhuma query, mutation, hook ou regra de negócio será alterada.
- ✅ Sidebar, color picker e header reaproveitam componentes existentes (zero duplicação).
- ✅ Inbox Drawer continua funcionando (provider já está global no `App.tsx`).
- ✅ Permissões via `ScreenProtectedRoute` permanecem intactas.
- ✅ Bilíngue PT/中文 mantido em todos os textos.