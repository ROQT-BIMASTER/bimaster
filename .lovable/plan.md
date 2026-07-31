## Objetivo
Garantir que tarefas abram e fechem com um único clique, que exclusões/alterações apareçam imediatamente sem F5 e que o Kanban não faça requisições desnecessárias.

## Diagnóstico confirmado
- O cartão só abre a tarefa ao clicar diretamente no texto do título; o restante do card não executa a seleção (`ProjetoKanbanView.tsx:646-655`), produzindo a sensação de precisar clicar duas vezes.
- O fechamento remove `?tarefa=` e dispara imediatamente um refetch completo das tarefas (`ProjetoDetalhe.tsx:221-227`), concorrendo com o fechamento do drawer e com as atualizações pendentes.
- Upload e exclusão de anexos fazem atualização otimista, mas terminam com invalidação sem refetch (`refetchType: "none"` em `useProjetoTarefaDetalhe.ts:295-297, 328-330`). Como o cache global não atualiza ao voltar para a aba, dados podem permanecer antigos até F5.
- O drawer e o card usam caches diferentes para os mesmos anexos; a mutation do drawer não atualiza explicitamente o resumo exibido no Kanban.
- O canal de anexos do Kanban escuta alterações amplas, inclusive de outros projetos, gerando invalidações e trabalho desnecessários.
- O preview completo baixa novamente o mesmo arquivo a cada abertura, sem reaproveitar o Blob já carregado na sessão.

## Implementação
1. **Abertura com um clique**
   - Tornar toda a área útil do card clicável, preservando ações independentes de concluir, arrastar, anexos, zoom e menus com `stopPropagation`.
   - Manter acessibilidade por teclado e impedir abertura acidental ao finalizar um arraste.

2. **Fechamento imediato e confiável**
   - Separar o fechamento visual do refetch: remover imediatamente a tarefa selecionada/URL e não bloquear a animação do drawer com consulta completa.
   - Liberar corretamente os gates de detalhe e executar reconciliação em segundo plano somente após o drawer fechar.
   - Tratar alterações pendentes de título/descrição antes do fechamento para não perder edição.

3. **Atualização sem F5**
   - Adicionar sincronização em tempo real filtrada pela tarefa para anexos do drawer.
   - Após upload/exclusão, reconciliar a query ativa e atualizar/invalidate também o resumo de anexos do Kanban.
   - Aplicar o mesmo padrão filtrado aos documentos China exibidos na tarefa, para mudanças feitas por outra aba/usuário aparecerem abertas no drawer.

4. **Redução de lentidão**
   - Restringir as invalidações de anexos às tarefas/projeto afetados, evitando que alterações de outros projetos recarreguem o quadro atual.
   - Preservar o cache e prefetch existentes de thumbnails.
   - Adicionar cache de sessão para o Blob do preview completo, evitando baixar novamente o mesmo arquivo enquanto ele não mudar.

5. **Validação e proteção de produção**
   - Criar testes para: clique único no card, fechamento pelo X após exclusão, atualização imediata do drawer e do card, e isolamento das invalidações por projeto/tarefa.
   - Executar os testes focados e validar no preview o fluxo real: abrir tarefa, excluir anexo, fechar pelo X, reabrir com um clique e confirmar que nenhum F5 é necessário.
   - Registrar a correção no changelog e incrementar `APP_VERSION` conforme a disciplina de release do projeto.