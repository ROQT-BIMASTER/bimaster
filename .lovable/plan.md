
# Corrigir sobreposição header × tabela em Produtos Acabados

## Diagnóstico

A tela `src/pages/FabricaProdutosAcabados.tsx` hoje tem três problemas combinados que produzem a sobreposição:

1. **Sticky com âncora errada.** O `<TableHeader>` usa `sticky top-[var(--app-header-height,52px)]`, mas está dentro de `<div className="overflow-x-auto">` (linha 1212). Quando um ancestral tem `overflow` (mesmo só no eixo X), o sticky "gruda" nesse container, não no viewport. Resultado: o header da tabela desloca de forma inconsistente conforme a página rola.
2. **Sem container scrollável próprio.** A página inteira rola dentro do `<main>` do `DashboardLayout` — KPIs, alertas, sidebar de filtros e tabela compartilham o mesmo scroll. O cabeçalho da tabela acaba "viajando" sobre KPIs/alertas/legenda porque todos vivem no mesmo fluxo vertical.
3. **`top` mágico (52px).** O valor é fixo e não acompanha mudanças (banner de impersonação adiciona `pt-12`, alertas offline empurram conteúdo). Quando o offset real muda, o header da tabela cobre as primeiras linhas.

## Estrutura proposta

Adotar exatamente o padrão flex-column que você descreveu, escopado à área de conteúdo da tela:

```text
DashboardLayout (já fornece header global sticky)
└── Página (flex flex-col, altura = viewport - header)
    ├── Bloco fixo (não rola)
    │   ├── Título + ações
    │   ├── KPIs
    │   └── Alerta consolidado (em revisão / mismatch)
    └── Bloco scrollável (flex-1, overflow-auto)
        └── Grid: [aside filtros] [Card da tabela]
            └── Tabela com TableHeader sticky top-0 (gruda no topo deste bloco)
```

O cabeçalho da tabela passa a usar `sticky top-0` **dentro do bloco scrollável**, sem depender de `--app-header-height`. A âncora do sticky é o próprio container de scroll, então sempre fica colado no topo da área visível da tabela, sem sobrepor KPIs ou alertas (que ficam fora da área de scroll).

## Mudanças de código

### `src/pages/FabricaProdutosAcabados.tsx`

1. **Wrapper raiz da página** (linha 656):
   - Trocar `min-h-[calc(100vh-52px)]` por `h-[calc(100vh-var(--app-header-height,52px))] flex flex-col` e remover `space-y-4` do raiz (vai para os blocos internos).
   - Manter `bgStyle` e o pattern `-m-4 sm:-m-6 p-4 sm:p-6`.

2. **Bloco fixo (header + KPIs + alerta consolidado)**:
   - Envolver título, dashboard administrativo, KPIs e alerta em um `<div className="shrink-0 space-y-4">`.
   - Esse bloco rola junto com a página apenas se ultrapassar a altura — caso contrário fica visível e a tabela ocupa o resto.

3. **Bloco scrollável (filtros + tabela)**:
   - Substituir `<div className="flex gap-4">` (linha 817) por `<div className="flex-1 min-h-0 flex gap-4 overflow-hidden">`.
   - O `min-h-0` é essencial: sem ele o flex item não respeita `flex-1` em altura.
   - Sidebar de filtros vira `<aside className="w-56 shrink-0 overflow-y-auto">` (rola independente).
   - Remover o `sticky top-[calc(var(--app-header-height,52px)+12px)]` da sidebar de filtros — agora ela vive em seu próprio container scrollável.
   - Coluna principal: `<div className="flex-1 min-w-0 overflow-auto">` — esse é o **único** container scrollável da tabela.

4. **Card da tabela**:
   - Remover `overflow-hidden` do Card e o `<div className="overflow-x-auto">` interno (linha 1212).
   - Mover o overflow horizontal para um wrapper único: `<div className="overflow-x-auto">` envolvendo apenas `<Table>`, mas dentro do container de scroll vertical.
   - Alternativa mais robusta: aplicar `overflow-auto` (X+Y) no container da coluna principal e deixar a `<Table>` com `min-w-[1200px]` para forçar scroll horizontal quando necessário. Isso garante um único contexto de scroll → sticky funciona perfeitamente.

5. **TableHeader sticky**:
   - Trocar `sticky top-[var(--app-header-height,52px)] z-30` por `sticky top-0 z-20`.
   - O `top-0` agora é relativo ao container de scroll (a coluna principal), não ao viewport.
   - Manter `bg-secondary`/`bg-muted/40`, `backdrop-blur` e `shadow-[0_1px_0_0_hsl(var(--border))]` para o ritmo visual.

6. **Legenda da tabela** (linha 1214):
   - Também `sticky top-0 z-20` se quisermos mantê-la visível, OU deixá-la rolar com o conteúdo (preferência: rolar — ela é informativa, não operacional).

7. **Modo foco** (linha 1123):
   - Já usa `fixed inset-0 z-50 flex flex-col`. Manter, mas garantir que o `Card` interno também siga `flex-1 min-h-0 overflow-auto` e o TableHeader use `sticky top-0` (mesmo princípio).

## Garantias

- **Sem `top` mágico**: o sticky usa `top-0` relativo ao seu container de scroll.
- **Sem sobreposição**: KPIs/alertas/filtros vivem fora da área scrollável da tabela; o cabeçalho da tabela só pode "cobrir" linhas da própria tabela (comportamento esperado).
- **Scroll isolado**: apenas a coluna da tabela rola; sidebar de filtros rola independente; bloco fixo nunca some.
- **Responsivo**: `flex-col` + `min-h-0` + `flex-1` funciona idêntico em qualquer largura. Em telas estreitas, a sidebar continua colapsável (botão "Filtros" já existe).
- **Compatível com banner de impersonação e alertas offline**: a altura é calculada via `100vh - var(--app-header-height)`, e qualquer banner que o `DashboardLayout` injete entre o header e o conteúdo passa a empurrar a página inteira (sem quebrar o sticky, que é relativo ao container interno).
- **Zero mudança em queries, filtros, lógica de KPIs, RLS ou regras de negócio.**

## Fora de escopo

- Não tocar em `DashboardLayout.tsx` (já expõe `--app-header-height` corretamente).
- Não replicar a refatoração agora em telas irmãs (`ProdutosBrasilListagem`, `FichaRevisaoDiretoria`, `FabricaComunicacaoRevisoes`) — fica como follow-up se aprovado o resultado aqui.

## Critério de aceite

1. Rolar a lista de produtos: cabeçalho da tabela permanece colado ao topo da área da tabela, sem cobrir KPIs nem alertas.
2. KPIs, alerta âmbar e título permanecem visíveis o tempo todo (não rolam junto com a tabela).
3. Sidebar de filtros rola independente quando tem muitos filtros.
4. Modo foco (tela cheia) mantém o mesmo comportamento, sem regressão.
5. Ativar/desativar o banner de impersonação não quebra alinhamento.
