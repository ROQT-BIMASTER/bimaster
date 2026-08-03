# Status do checklist China em português e chinês

Todo status de documento passa a exibir o rótulo bilíngue, no formato `Em análise 审核中`, mantendo a mesma cor e o mesmo ícone já unificados na paleta.

## O que muda

Um único dicionário de rótulos passa a guardar as duas línguas para cada status (Não criado, Rascunho, Planejado, Pendente de aprovação, Em análise, Enviado ao Brasil, Aprovado, Ciente, Não aprovado, Contestado). Todas as telas do checklist China leem desse dicionário:

- Tela de Status do produto — lista e quadro Kanban do checklist
- Modo Foco do checklist
- Painel lateral do item (badge de status atual, histórico de versões e o seletor de status)
- Diálogo de ações em lote nos documentos

Em espaços estreitos (cartões do Kanban, badges de histórico) o chinês aparece em tamanho menor logo após o texto em português, para não quebrar o layout.

## Detalhes técnicos

- `src/lib/china/docStatus.ts`: `DOC_STATUS_LABEL` passa a `{ pt, zh }`; `docStatusLabel(status)` retorna a string bilíngue por padrão e ganha um parâmetro para obter só uma das línguas; `DECISAO_LABEL` recebe o mesmo tratamento. A tabela de tons/ícones (`docStatusVisual`) não muda.
- `src/pages/ChinaProdutoChecklistStatus.tsx`: `STATUS_LABEL` local é removido em favor do dicionário central; o mapa `statusLabelI18n` continua servindo o modo por idioma, com fallback bilíngue.
- `src/components/china/ChinaChecklistFocusMode.tsx`: badges passam a usar o rótulo central em vez de `STATUS_LABELS` (que já era parcialmente bilíngue), eliminando divergência entre os dois dicionários.
- `src/components/china/checklist/ChecklistItemPainel.tsx`: `STATUS_OPTIONS` passa a montar o rótulo a partir do dicionário central, então o seletor de status também fica bilíngue.
- `src/components/projetos/AprovacaoLoteDialog.tsx`: já consome `docStatusLabel`, herda o texto bilíngue automaticamente.
- `src/test/china-doc-status.test.ts`: expectativas atualizadas para o formato bilíngue, mais um caso cobrindo a extração só-PT e só-中文.
- Bump de `APP_VERSION` para 3.9.4.
