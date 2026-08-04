# Etiqueta visual de status em todos os ambientes China

Objetivo: qualquer documento/item do fluxo China mostra sempre uma etiqueta bilíngue (PT 中文) com ícone e cor — Em análise / Aprovado / Não aprovado / Enviado / Pendente — e cada tela ganha um filtro rápido por esses estados.

## 1. Componente único de etiqueta

Criar `src/components/china/DocStatusTag.tsx`, consumindo o que já existe em `src/lib/china/docStatus.ts` (`bucketFluxo`, `docStatusVisual`, `docStatusIconComponent`, `checklistStatusTexto`):

- Props: `status`, `size` (`xs` | `sm`), `idioma` (`bi` | `pt` | `zh`), `showIcon`.
- Sempre ícone + cor + texto (cor nunca é o único sinal).
- Tooltip com o rótulo completo bilíngue quando truncado.

Substituir os badges ad-hoc por esse componente nas telas abaixo.

## 2. Ambientes que passam a exibir a etiqueta

- Fluxo do Checklist na Caixa de Entrada (`ChecklistFlow`/`FlowNode`): hoje o nó é só um círculo colorido. Passa a mostrar uma micro-etiqueta abaixo do rótulo com o estado do item.
- Painel de leitura da Caixa de Entrada (`MailboxReadingPane`) e lista (`MailboxList`): etiqueta por item/documento.
- Kanban da Caixa de Entrada (`MailboxKanban`): etiqueta no cartão.
- Checklist Status (`ChinaProdutoChecklistStatus`) e Modo Foco (`ChinaChecklistFocusMode`): padronizar para o novo componente.
- Painel do item (`ChecklistItemPainel`), cartão de documento (`ChinaDocCard`) e tabela de vinculação (`VincularChinaTable`).

## 3. Filtros por estado

Criar `src/components/china/ChinaStatusFilterChips.tsx` — chips com contador, mesma paleta, multi-seleção e botão "Limpar" (mesmo padrão de `DocStatusFilterBar` em Projetos, mas com o vocabulário do fluxo China e bilíngue).

Aplicar em:
- Fluxo do Checklist (a legenda atual vira filtro clicável — clicar em "em análise" mantém só esses nós/itens em destaque).
- Checklist Status e Modo Foco.
- Caixa de Entrada: lista e Kanban (complementando os filtros existentes em `MailboxKanbanFilters`).
- Tabela de vinculação.

Estado do filtro é local por tela, com persistência em `localStorage` por tela (mesmo padrão de densidade já usado em Projetos).

## 4. Detalhes técnicos

- Nenhuma alteração de banco ou de regra de negócio; apenas apresentação e filtragem no cliente.
- Toda a classificação vem de `bucketFluxo` — nada de comparação de string solta nas telas.
- Testes: estender `src/lib/china/__tests__/fluxoUnificado.test.ts` e adicionar teste de render do `DocStatusTag` (rótulo bilíngue + ícone por bucket) e do filtro (contagem e alternância).
- Bump de `APP_VERSION` + entrada no changelog em `src/pages/admin/ApiDocumentation.tsx`.
