## Objetivo

Repaginar a tela de **Focus Mode da Submissão China** mostrada na imagem (modal aberto a partir de `ProjetoVincularChina.tsx` → `ChinaSubmissaoExpandido.tsx` + `FocusModeDespachosWrapper`) para herdar o mesmo vocabulário visual do **ambiente de Projetos** (`ProjetoSecao` + `ProjetoTarefaRow`): densidade alta tipo planilha, header sticky com chips informativos, seções colapsáveis com barra colorida lateral, "linhas tipo tarefa" com colunas alinhadas, e badges com contraste otimizado.

A funcionalidade (seleção em lote, despacho, vincular, abrir ficha, inbox de decisões) **não muda** — apenas a apresentação.

---

## Arquivos afetados

1. `src/pages/ProjetoVincularChina.tsx` — header do `Dialog` do focus mode (linhas ~662–698).
2. `src/components/china/ChinaSubmissaoExpandido.tsx` — corpo (re-organização visual completa).
3. `src/components/china/ChinaInboxDecisoes.tsx` — apenas estilização do "Nenhuma decisão do Brasil recebida." e do header do bloco para combinar com seções de Projetos (sem mudar lógica).
4. `src/components/processo/DespachosPanel.tsx` (renderizado dentro de `FocusModeDespachosWrapper`) — apenas tokens/typografia do header "Despachos do Processo" para alinhar com o padrão.

Nenhuma migration, hook ou RPC envolvido. Sem mudança de schema. Sem nova rota.

---

## Mudanças visuais (mapeadas ao padrão de Projetos)

### 1. Header do modal (DialogHeader)
- Substituir o "card-cabeçalho" cinza atual por barra **sticky compacta** estilo `ProjetoSecao` (densidade reduzida, `px-4 py-3`, fundo `bg-card`, borda inferior `border-b`).
- Layout em 3 zonas:
  - **Esquerda**: ícone produto (12×12, `rounded-md bg-primary/10`) + código (`font-mono text-primary`) + nome + badge de status.
  - **Centro**: chips informativos compactos (`Fórmula`, `Qtd`, `Peso`, `Item`) – usar o mesmo componente visual de chip que já aparece em linhas de tarefas (texto `text-[11px]`, label `text-muted-foreground`, valor `font-medium`). Hoje esses dados estão em um grid no corpo; mover para o header dá foco imediato igual aos cabeçalhos de projetos.
  - **Direita**: badge `OC: …` (já existe) + botão fechar.

### 2. Corpo: dois "blocos seção" estilo Projetos
Reorganizar o conteúdo em **duas seções colapsáveis** com a mesma estética de `ProjetoSecao` (border-left colorida, header com chevron + título + counter badge):

**Seção A — "Documentos da Submissão"** (`border-l-blue-500`)
- Header: `ChevronDown` + "Documentos" + counter `{total}` + ações da direita (`Selecionar todos (N pendentes)` migrado para o cabeçalho da seção, à direita, alinhado com o padrão de Projetos onde ações ficam no header da seção).
- Subgrupos por categoria (`DADOS OFICIAIS`, `OUTROS`, `Fotos da Planilha`, etc.) viram **sub-headers tipo "section divider"** (uppercase, tracking-wider, `text-[10px]`) já existentes — manter, apenas padronizar espaçamento `mt-3 mb-1`.
- Cada documento vira uma **linha planilha** com colunas alinhadas (mesmo grid pattern de `ProjetoTarefaRow`):
  - col 1: checkbox (3.5×3.5) — só visível quando pendente
  - col 2: número anexo monoespaçado (`text-[10px] w-8`)
  - col 3: ícone tipo (FileText/Camera) + nome (truncate, `text-[12px]`)
  - col 4: status badge compacto (mesma paleta do `STATUS_COLORS_LIST` de projetos: success/warning/destructive/outline com texto branco e borda branca para contraste, vindo de `projetoConstants.ts`)
  - col 5: ações (Abrir, Vincular, Despachar) — ícones 3×3, opacidade 0 → 100 no hover (já é o comportamento, só ajustar `gap` e altura `h-7`)
- Border-left de status do despacho mantém-se (já existe), mas troca para a paleta `STATUS_COLORS_LIST` de Projetos para coerência cromática.
- A "ficha virtual" continua com destaque (border-left primary + bg-primary/5), mas ganha o ícone `FileSpreadsheet` (mesmo usado em Briefing de Projetos) em vez de emoji 📋.

**Seção B — "Despachos do Processo"** (`border-l-purple-500`)
- O bloco já existe em `DespachosPanel`. Aplicar:
  - Header padronizado com chevron + título + counter + barra de progresso à direita (já tem progresso — só recolocar dentro do header sticky da seção).
  - "Itens Pendentes na China" e os chips amarelos viram um **callout** estilo o `BriefingView` de projetos (fundo `bg-amber-500/5`, border `border-amber-500/30`, ícone `AlertTriangle` no canto), em vez do bloco solto atual com borda vermelha.

**Seção C (vazio)** — "Decisões do Brasil"
- Trocar o texto solto "Nenhuma decisão do Brasil recebida." por um **empty-state padronizado** igual ao de seções vazias em Projetos: ícone `Inbox` 8×8 muted, título e subtítulo, dentro de um container `bg-muted/30 rounded-lg py-6` centralizado.

### 3. Tokens, badges e densidade
- Trocar tamanhos `text-[8px]/[9px]` (atualmente exagerados) por `text-[10px]/[11px]` consistentes com Projetos.
- Badges: usar variantes `success/warning/destructive/outline` com a versão de **alto contraste** (texto/borda brancos no escuro) já adotada em `ProjetoTarefaRow` — importar via `STATUS_COLORS_LIST_DARK` de `projetoConstants.ts` para os indicadores de status do despacho.
- Espaçamento vertical do conteúdo do dialog: `space-y-4` entre seções, `space-y-1` dentro de cada seção (igual `ProjetoSecao`).
- Remover o fundo `bg-muted/20` do `ChinaSubmissaoExpandido` quando renderizado em focus mode — passar uma prop `variant?: "inline" | "focus"` (default `"inline"`) e, quando `"focus"`, usar `bg-card` puro com seções delimitadas por borda, igual ao layout de Projetos que é "white-on-card".

### 4. Comportamento preservado
- Todos os handlers (`toggleSelectAll`, `handleOpenDespacho`, `handleOpenVincular`, `setBatchDespachoOpen`, `onPreviewDoc`, navegação para a Ficha) **permanecem idênticos**.
- A barra de seleção em lote (atualmente fica logo abaixo do header) passa a ser **sticky no fundo do scroll area**, padrão `PresentationActionsBar` do Trade — assim não some quando o usuário rola até a seção de Despachos.

---

## Critérios de aceite

- O modal abre com header denso e chips de Fórmula/Qtd/Peso visíveis sem precisar rolar.
- Documentos aparecem como linhas alinhadas em colunas, com checkbox/numero/nome/status/ações nas mesmas posições — visualmente "irmão" das linhas de tarefas em `/dashboard/projetos/:id`.
- Seções "Documentos", "Despachos do Processo" e "Decisões do Brasil" têm border-left colorida, header colapsável e contador, idênticos a `ProjetoSecao`.
- Nenhum endpoint, query, RPC ou rota foi modificado.
- A barra de "X selecionado(s) — Despachar" fica sticky no rodapé do scroll do dialog.
- `APP_VERSION` será incrementada para `3.4.26` e uma entrada de changelog adicionada em `src/lib/version.ts` (regra obrigatória de release-changelog-discipline).

## Fora do escopo
- Mudanças na lógica de despacho, vínculo, decisões ou na inbox.
- Alterações em telas fora do focus mode da submissão (ex.: a listagem `ProjetoVincularChina` não muda).
- Migrations ou Edge Functions.
