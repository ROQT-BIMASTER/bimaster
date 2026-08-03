# Filtros no diálogo de Ações em lote nos documentos

Adicionar três filtros na janela "Ações em lote nos documentos" do quadro do projeto, para restringir a lista antes de selecionar e aplicar a ação.

## Filtros a adicionar

1. **Coluna do Kanban** — seleção múltipla das colunas (seções) do quadro atual. Mostra somente documentos de tarefas daquela coluna.
2. **Categoria do documento** — seleção múltipla das categorias já usadas no módulo China (Dados Oficiais, Fotos da Planilha, Artes, Facas/Amostras, Etiquetas, EAN, etc.), derivadas do tipo de cada documento.
3. **Tarefa** — seleção múltipla das tarefas que possuem documentos no escopo atual, com busca por texto para quadros grandes.

## Comportamento

- Os três filtros são combinados entre si (E) e continuam respeitando o escopo já existente: tarefas visíveis no quadro filtrado, chips de situação e ordenação por data.
- Cada opção de filtro mostra a quantidade de documentos elegíveis; opções sem documentos ficam desabilitadas.
- O contador "X de Y selecionado(s)" e "Selecionar todos os elegíveis" passam a considerar apenas a lista filtrada.
- Ao mudar qualquer filtro, itens que saírem da lista são removidos automaticamente da seleção (evita aplicar ação em documento invisível).
- Botão "Limpar filtros" quando houver algum ativo, e um resumo textual do escopo aplicado no lugar do aviso atual.
- Filtros são reiniciados a cada abertura do diálogo; não alteram os filtros do quadro.
- Cada linha da lista passa a exibir também a coluna do Kanban e a categoria, além da tarefa e do tipo já mostrados.

## Detalhes técnicos

- `src/components/projetos/ProjetoKanbanView.tsx`: passar para `AprovacaoLoteDialog`, além de `tarefaIds`, a lista de tarefas visíveis com `{ id, titulo, secao_id }` e as seções `{ id, nome }` do quadro.
- `src/components/projetos/AprovacaoLoteDialog.tsx`: novos estados locais de filtro (colunas, categorias, tarefas) aplicados dentro do `useMemo` de `elegiveis`, antes do descarte de documentos já na situação alvo e da ordenação por `ordenarDocs`. UI com `Popover` + `Checkbox` (padrão já usado no projeto) em uma barra acima da lista.
- Categoria resolvida por `tipo_documento` usando `DOCUMENT_CATEGORIES` de `src/lib/china-document-types.ts` (mapa tipo → categoria montado uma vez com `useMemo`); tipos sem categoria caem em "Outros".
- Coluna do Kanban resolvida pelo `secao_id` da tarefa vinculada ao documento (`tarefa_id` já vem de `useProjetoChinaDocs`).
- Sem mudanças de backend: nenhuma alteração em RPCs, tabelas ou políticas de acesso; as ações de aprovar/não aprovar continuam com senha e trilha por documento.
- Registrar a mudança no changelog de `ApiDocumentation.tsx` conforme a disciplina de release.
