## Diagnóstico (verificado no banco e no código)

Testei a submissão HB-M609 (projeto-espelho `Submissão HB-M609 — concealer`, o mesmo da sua tela):

- Os 12 documentos da submissão **estão** vinculados a alguma tarefa (`china_produto_documentos.projeto_tarefa_id` preenchido em 12/12).
- Porém **nenhuma tarefa do checklist recebeu anexo**. As tarefas "Fórmulas", "Cores do Produto", "Desenho Técnico", "Planilha Excel", "Embalagem (Referência)", "Produto Aprovado", "Imagens" estão com 0 anexos.
- Em vez disso, o sistema criou **11 tarefas paralelas** na seção "Outros documentos", com títulos técnicos crus: `custom_1785170511136_idzig_formulas`, `foto_embalagem_ref`, `foto_cores_produto`, `custom_..._desenho_tecnico`, `Pedido China (Planilha Excel)` (3x), etc. — cada uma segurando 1 arquivo.

**Causa raiz**: a rotina de criação do projeto casa documento ↔ tarefa comparando `tipo_documento` do arquivo com a `tipo_key` da estrutura do checklist. Os arquivos foram enviados com chaves do Cofre (`cofre_<uuid>`) e chaves custom (`custom_<timestamp>_<hash>_<slug>`), que não batem com as chaves da estrutura enviada na conversão. Sem match, cada arquivo cai no caminho de "documento avulso" e gera uma tarefa nova. O resultado é exatamente o sintoma relatado: tarefa do checklist nasce vazia e o arquivo fica "escondido" numa tarefa duplicada.

Secundário: o Kanban não tem nenhum indicador de anexo (o card não carrega contagem de anexos), então mesmo quando o vínculo existe, é invisível.

O que **já funciona** e será preservado: o Drawer e o Focus Mode já possuem seção de anexos da tarefa e seção de documentos China; a RPC de sincronização pós-criação e o gatilho em novos documentos já existem; os arquivos não são duplicados fisicamente (o anexo aponta para o mesmo caminho no armazenamento).

---

## Plano

### 1. Corrigir o casamento documento → tarefa do checklist (raiz)
Reescrever a resolução de tarefa, com cascata determinística, usada tanto na criação do projeto quanto na sincronização contínua:

1. `tipo_documento` igual à `tipo_key` da estrutura (comportamento atual);
2. **novo** — resolver rótulo do tipo: item custom do checklist da submissão, item do Cofre (`cofre_<uuid>` → nome do item), catálogo padrão de tipos de documento; casar pelo rótulo com o título da tarefa (normalizado: minúsculo, sem acento, sem pontuação);
3. **novo** — casar pelo sufixo semântico das chaves custom (`custom_<ts>_<hash>_formulas` → `formulas`) contra a chave/rótulo do item do checklist;
4. **novo** — casar pela categoria do documento quando existir apenas um item do checklist naquela categoria;
5. só então cair em "Outros documentos" — e, nesse caso, agrupar todos os arquivos sem match do **mesmo tipo** em **uma única** tarefa, com título legível (rótulo resolvido), nunca a chave crua.

Também remover a regra atual de "reusa a tarefa de qualquer documento do mesmo tipo", que hoje pode espalhar arquivos em tarefas erradas.

### 2. Permitir que um documento apareça em mais de uma tarefa
O campo `projeto_tarefa_id` (1:1) é usado como marcador de "já processado" e impede reprocessamento correto. A tabela de vínculo `china_documento_tarefa_vinculos` (N:N) passa a ser a fonte de verdade; `projeto_tarefa_id` continua sendo preenchido como vínculo primário para compatibilidade, mas a idempotência passará a ser avaliada pela tabela de vínculos.

### 3. Repriorizar/limpar o histórico já quebrado (reparo de dados)
Nova rotina de reparo, idempotente e reversível, executada sob demanda por um botão "Reorganizar documentos" (visível para administradores) no cabeçalho do projeto-espelho e no painel Vincular China:

- reprocessa cada documento pela nova cascata;
- move o anexo e o vínculo para a tarefa correta do checklist;
- as tarefas órfãs de "Outros documentos" criadas automaticamente e que ficarem sem anexo, sem comentários e sem responsável são enviadas para a lixeira (soft delete), não apagadas;
- devolve um resumo (movidos / mantidos / arquivados).

Nenhuma alteração automática em massa em projetos existentes sem clique explícito.

### 4. Indicadores de anexo no Kanban
- Carregar, em uma única consulta agregada por projeto, a contagem de anexos por tarefa (anexos da tarefa + documentos China vinculados, sem duplicar o mesmo arquivo).
- No card: selo com ícone de clipe e contagem (`3 arquivos`), e quando houver imagens, até 3 miniaturas em faixa; para não-imagens, ícone por tipo (planilha, PDF, imagem, vetor, genérico).
- Tarefas de checklist sem nenhum arquivo recebem selo discreto "Aguardando documentos".
- Novo filtro no quadro: "Com anexos" / "Sem anexos".

### 5. Visualização dentro da tarefa
A seção de anexos e a de documentos China já existem no Drawer e no Focus Mode; ajustes:
- unificar as duas listas numa visão única "Arquivos", agrupada por origem (Submissão China / Enviados no projeto), evitando o mesmo arquivo aparecer duas vezes;
- miniatura para imagens, ícone por tipo para os demais;
- pré-visualização em tela cheia e download autenticado por blob (padrão já usado no módulo China), respeitando as permissões atuais.

### 6. Sincronização contínua (inclusão, exclusão, substituição, aprovação, versão)
- Gatilho já existente para inclusão passa a usar a nova cascata.
- Novos gatilhos para: exclusão de documento (remove vínculo e anexo espelhado), troca de arquivo/nova versão (atualiza caminho e nome no anexo espelhado), mudança de status (aprovado/rejeitado reflete no selo do arquivo na tarefa).
- Atualização em tempo real na interface por canal de eventos das tabelas de documentos e vínculos, invalidando as consultas de tarefas, anexos e contadores do Kanban — sem recarregar a página.

### 7. Retorno para a China
Garantir que documentos gerados/aprovados no projeto e vinculados à tarefa permaneçam associados à submissão de origem (com registro de versão e histórico), de modo que o fluxo de retorno use sempre a última versão aprovada.

### 8. Testes e proteção contra regressão
- Testes de unidade da nova cascata de casamento (chaves cofre, custom com sufixo, rótulo com acento, sem match).
- Teste de integração: submissão com 12 documentos gera projeto onde cada item do checklist com arquivo tem anexo, e nenhuma tarefa com título de chave crua é criada.
- Teste de idempotência: executar criação + sincronização + reparo duas vezes não duplica tarefas nem anexos.
- Rodar a suíte completa antes de fechar; bump de `APP_VERSION` com entrada no changelog.

---

## Detalhes técnicos

- Alterações de banco: nova função de resolução de tarefa (`fn_china_resolver_tarefa_documento`), reescrita de `rpc_china_criar_projeto_espelho` e `rpc_china_sincronizar_documentos_projeto` para usá-la, nova `rpc_china_reparar_documentos_projeto`, gatilhos de exclusão/atualização em `china_produto_documentos`.
- Sem duplicação física de arquivos: `projeto_tarefa_anexos.storage_path` continua apontando para o mesmo objeto do balde `china-documentos`, com `metadata.china_documento_id` como elo de rastreabilidade.
- Contagem no Kanban via consulta agregada única por projeto (sem N+1), em cache do TanStack Query com invalidação por evento.
- Frontend afetado: `ProjetoKanbanView.tsx`, `TarefaAnexosSection.tsx`, `TarefaChinaDocsSection.tsx`, `TarefaFocusMode.tsx`, `ProjetoHeader.tsx`, `VincularChinaSidePanel.tsx`, hooks `useChinaDocsDaTarefa`, `useProjetoTarefas` e novo `useTarefasAnexosCount`.
- Compatibilidade: nenhuma mudança no gatilho de criação automática do projeto a partir da submissão; o reparo de projetos antigos é manual e reversível.
