
# Caixa de Entrada China — Visão Desktop em Tabela + Agrupamento + Filtros

## Diagnóstico atual
A tela `/dashboard/fabrica-china/caixa-entrada` lista cada documento como um card grande (`ChinaInboxItem`), em coluna única. Em desktop (1510px) isso desperdiça espaço horizontal e gera poluição visual quando o mesmo produto/OC tem 5–10 documentos — o usuário rola muito e perde o contexto de "quais docs são desse produto".

Hoje só existe:
- 3 abas estáticas (Todos / Aguardando / Ajustar)
- Sem busca, sem filtro por OC, produto, tipo, idade ou responsável
- Sem agrupamento — docs do mesmo produto ficam intercalados com outros produtos
- Sem ações em lote (aprovar todos os docs de uma submissão de uma vez)

## Objetivo
Transformar a Caixa de Entrada em uma **central operacional desktop**, mantendo 100% das funcionalidades atuais (aprovar, pedir ajuste, ver, corrigir, auto-advance CTA, realtime), mas com:
1. **Visão tabela densa** (modo padrão em desktop ≥ lg)
2. **Agrupamento Pai → Filhos** por Submissão/Produto (expansível)
3. **Filtros avançados** (busca, OC, tipo de documento, urgência, status)
4. **Ações em lote** por submissão (aprovar todos, pedir ajuste em todos)
5. **Toggle Tabela ⇄ Cards** (mobile cai automaticamente em cards)

## Mudanças

### 1. Hook `useChinaInbox` — agregar dados de agrupamento
- Manter o shape atual de `ChinaInboxItem` (compatível com modo cards)
- Adicionar derivação `groupedBySubmissao`: `Map<submissao_id, { submissao, items[] }>`
- Adicionar campos opcionais já trazidos pelo join: `numero_ordem`, `produto_codigo`, `produto_nome`, `submissao_status`
- Expor `tiposDisponiveis` (lista única de `tipo_documento` presente no resultado, para popular o filtro)

### 2. Novo componente `ChinaInboxToolbar.tsx`
Barra superior com:
- **Busca textual** (debounce 250ms): filtra por `produto_codigo`, `produto_nome`, `numero_ordem`, `nome_arquivo`, `tipo_documento`
- **Select OC** (multi): lista todas as OCs presentes
- **Select Tipo de Documento** (multi): usa `CHINA_DOCUMENT_TYPES`
- **Select Urgência**: Todos / +24h / +48h / +72h
- **Toggle "Agrupar por produto"** (ligado por padrão em desktop)
- **Toggle Tabela / Cards** (sticky no estado do usuário via `localStorage`)
- **Contador de filtros ativos** com botão "Limpar"

### 3. Novo componente `ChinaInboxTable.tsx` (modo desktop)
Tabela densa (10–11px estilo Ficha de Análise) com:

**Linha-pai (submissão / produto)** — expansível via chevron:
| ▾ | Produto | OC | Total Docs | Pendentes | Ajuste | Mais antigo | Ações lote |

- Badge de status agregado (todos aprovados → verde; algum em ajuste → vermelho; aguardando → amarelo)
- Ações em lote para BR: **"Aprovar todos / 全部批准"** e **"Pedir ajuste em todos"** (chama `aprovar.mutate` em loop com `Promise.all`)
- Click na linha-pai expande/colapsa filhos
- Botão "Abrir submissão" → navega para `/dashboard/fabrica-china/submissao/:id`

**Linhas-filho (documentos)** — recolhidas por padrão se >5 docs, expandidas se ≤5:
| ↳ | Tipo (PT 中文) | Arquivo | Idade | Status | Ver | Aprovar | Pedir ajuste |

- Reaproveita lógica de cores/urgência do `ChinaInboxItem`
- Botões compactos (h-7) com mesmos handlers (`onApprove`, `onReject`, `onView`, `onCorrigir`)
- Hover destaca linha; row striping sutil

### 4. Refator de `ChinaCaixaEntrada.tsx`
- Adicionar estado `viewMode: "table" | "cards"` (default `table` em ≥lg, `cards` em <lg via `useMediaQuery`)
- Adicionar estado de filtros: `{ busca, ocs[], tipos[], urgencia, agrupar }`
- Aplicar filtros sobre `items` antes de renderizar
- Renderizar `ChinaInboxToolbar` acima das Tabs
- Em modo `table`: `<ChinaInboxTable />`; em modo `cards`: lista atual de `ChinaInboxItem`
- Manter Tabs (Todos / Aguardando / Ajustar) como filtro rápido pré-toolbar
- Manter `ChinaAutoAdvanceCTA` no topo e `ChinaDocPreviewDialog` inalterados

### 5. Persistência leve de preferências
- `localStorage["china-inbox-view-mode"]`
- `localStorage["china-inbox-grouped"]`
- Filtros NÃO persistem (cada sessão zera) para evitar confusão com pendências escondidas

## Compatibilidade e não-regressão
- Nenhuma mudança em hooks de mutação (`useCriarRevisao`, `useDarCiencia`)
- Nenhuma mudança no schema do banco
- Realtime (`china-inbox-rt`) continua funcionando — apenas re-renderiza com novos filtros aplicados
- Mobile preserva 100% da experiência atual em cards
- Sidebar badge (`useChinaInboxCount`) continua funcionando

## Arquivos a criar
- `src/components/china/ChinaInboxToolbar.tsx`
- `src/components/china/ChinaInboxTable.tsx`
- `src/components/china/ChinaInboxTableGroupRow.tsx` (linha-pai com expand/collapse + ações lote)
- `src/components/china/ChinaInboxTableDocRow.tsx` (linha-filho compacta)
- `src/hooks/useMediaQuery.ts` (se ainda não existir — verificar antes)

## Arquivos a editar
- `src/pages/ChinaCaixaEntrada.tsx` — adicionar toolbar, viewMode, filtros locais
- `src/hooks/useChinaInbox.ts` — expor `tiposDisponiveis` e `ocsDisponiveis` derivados

## UX bilíngue (mantido)
Todos os labels em PT 中文 conforme padrão do módulo: "Aprovar todos / 全部批准", "Buscar / 搜索", "Tipo / 类型", "Agrupar / 分组", etc.
