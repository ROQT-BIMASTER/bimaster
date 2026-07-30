
## O que foi verificado no ambiente

Projeto HB-M609 (`fff155eb…`), submissão `40cf3313…`:

- O Kanban já tem as colunas/seções corretas espelhando o checklist: **Dados Oficiais, Fotos da Planilha, Composição, Desenhos Técnicos, Amostras, Composição Alteração, Mockup, Arte Final** — com as 11 tarefas do checklist, todas **com 0 anexos**.
- Os 12 documentos enviados estão em 12 tarefas avulsas na seção **Outros documentos**, algumas com título cru (`planilha_excel`, `foto_cores_produto`, `custom_1785170511136_idzig_formulas`) e três tarefas repetidas "Pedido China (Planilha Excel)" (uma por arquivo).
- Nenhuma tarefa de checklist tem a chave técnica gravada (`campos_customizados.china_tipo_key`) — o projeto nasceu antes disso existir.
- A função de resolução já existente, testada contra estes dados, **acerta 7 dos 10 tipos** (Planilha Excel → Dados Oficiais, Cores do Produto e Embalagem Referência e Produto Aprovado → Fotos da Planilha, Fórmulas → Composição, Desenho Técnico → Desenhos Técnicos, Imagens → Amostras). Só não resolve os 3 tipos vindos do Cofre do Produto (`cofre_…`), que não têm item equivalente no checklist.

Conclusão: a lógica existe e está correta, mas nunca foi executada sobre os projetos já criados, e a criação de projeto não grava a chave técnica.

## O que será feito

1. **Gravar a chave técnica na criação do projeto**
   `rpc_china_criar_projeto_espelho` passa a gravar em cada tarefa a `china_tipo_key` e a categoria de origem do checklist, para projetos novos já nascerem casados por chave (sem depender de rótulo).

2. **Backfill nos projetos existentes**
   Migration que preenche `china_tipo_key` nas tarefas `china_checklist_item` de todos os projetos-espelho, casando pelo rótulo do item de checklist da submissão.

3. **Reparo com consolidação e roteamento por categoria**
   Evoluir `rpc_china_reparar_documentos_projeto` para:
   - mover cada documento para a tarefa do checklist correspondente, **na seção igual à categoria do checklist** (Composição fica em Composição, Desenho Técnico em Desenhos Técnicos, etc.);
   - consolidar as tarefas duplicadas de "Outros documentos" por tipo (as três "Pedido China" viram uma tarefa com 3 anexos);
   - renomear títulos crus para o rótulo legível;
   - arquivar as tarefas automáticas que ficarem vazias (sem exclusão física).

4. **Itens do Cofre do Produto**
   Documentos com chave `cofre_…` passam a ser roteados para a seção da categoria do checklist quando o item do Cofre estiver mapeado; quando não houver correspondência, ficam numa seção única e legível "Cofre do Produto" (em vez de "Outros documentos" com uma tarefa por arquivo).

5. **Executar o reparo nos projetos-espelho existentes**
   Rodar a rotina de forma idempotente (incluindo HB-M609) e validar por consulta: nenhum documento com tipo de checklist fora da sua seção.

6. **Regressão e versão**
   Teste de integração garantindo que documento com tipo de checklist nunca cai em "Outros documentos", que o reparo é idempotente e que nenhum anexo é perdido. Bump de `APP_VERSION`.

## Detalhes técnicos

- Migrations: alteração de `rpc_china_criar_projeto_espelho`, backfill de `campos_customizados`, evolução de `rpc_china_reparar_documentos_projeto` — todas `SECURITY DEFINER` com `search_path = public`.
- Chave de consolidação: `(projeto_id, tipo resolvido)` restrita a tarefas `tipo_tarefa='china_documento'` e `canal_criacao='china_submissao'`.
- Movimentação preserva `projeto_tarefa_anexos.metadata->>'china_documento_id'` e a unicidade `(documento_id, tarefa_id)` em `china_documento_tarefa_vinculos`.
- Tarefas vazias recebem `excluida_em` (soft delete), nada é apagado.
