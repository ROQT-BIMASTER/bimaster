## Diagnóstico (verificado no banco)

- O vínculo documento → tarefa acontece **uma única vez**, dentro de `rpc_china_criar_projeto_espelho`, no momento da criação/vinculação do projeto. A função varre `china_produto_documentos` da submissão, cria tarefas por item de checklist (ou "Outros documentos"), grava `projeto_tarefa_anexos`, preenche `china_produto_documentos.projeto_tarefa_id` e insere em `china_documento_tarefa_vinculos`.
- **Não existe nenhum gatilho** em `china_produto_documentos` que refaça esse vínculo depois. Os gatilhos existentes são apenas: versionamento, avanço automático de status da submissão, notificação e indexação de busca.
- Consulta nas submissões com projeto-espelho: **10 documentos foram enviados após a criação do projeto e 100% deles estão sem `projeto_tarefa_id` e sem linha em `china_documento_tarefa_vinculos`** (44 documentos no total nessas submissões).
- Conclusão: documentos anexados depois da criação do projeto **não** chegam ao ambiente de Projetos automaticamente. Só entram se alguém usar o vínculo manual (`useCreateDocVinculo`) ou recriar o projeto com "substituir".

O checklist da submissão em si (Fluxo do Checklist / `china_checklist_item_estado`) continua correto — o problema é exclusivamente a ponte para tarefas/anexos do projeto.

## O que construir

### 1. Função de sincronização única (backend)
`public.rpc_china_sincronizar_documentos_projeto(p_submissao_id uuid)` — SECURITY DEFINER, idempotente:
- Resolve o projeto-espelho pela `china_submissao_projetos` (is_espelho). Sem projeto → no-op.
- Para cada documento da submissão com `arquivo_path` e sem `projeto_tarefa_id`:
  1. Tenta casar com uma tarefa existente do projeto pelo tipo do documento (mesma regra usada hoje na criação: correspondência com a chave do item de checklist / rótulo da tarefa `tipo_tarefa in ('china_checklist_item','china_documento')`).
  2. Sem correspondência, cria tarefa na seção "Outros documentos" (cria a seção se não existir), com o mesmo padrão de título, prazo e mapeamento de status já usado na RPC atual.
  3. Insere `projeto_tarefa_anexos` (com `metadata.china_documento_id`, sem duplicar), atualiza `projeto_tarefa_id` e insere em `china_documento_tarefa_vinculos` com `ON CONFLICT DO NOTHING`.
- Retorna JSON com contagem de vinculados/criados para uso na UI.
- Refatorar a RPC de criação para reaproveitar essa função no trecho de documentos, evitando duas cópias da regra.

### 2. Gatilho de tempo real
`AFTER INSERT OR UPDATE OF arquivo_path ON china_produto_documentos` chamando a sincronização apenas para aquele documento. Protegido para não falhar o upload: qualquer erro é capturado e apenas registrado em `china_timeline_eventos`.

### 3. Backfill
Migration executa a sincronização para todas as submissões com projeto-espelho, resolvendo os 10 documentos órfãos atuais.

### 4. Frontend
- Botão "Sincronizar documentos" na aba Submissão China do projeto e no painel de Vincular China, chamando a RPC e invalidando as queries `china-doc-vinculos`, `china-docs-da-tarefa`, `projeto-tarefas`.
- Indicador quando houver documentos da submissão ainda não vinculados ao projeto.
- Bump de `APP_VERSION` + entrada no changelog em `ApiDocumentation.tsx`.

### 5. Testes
- Teste de integração: documento inserido após a criação do projeto passa a ter `projeto_tarefa_id` e vínculo; reexecutar a sincronização não duplica anexos nem tarefas.

## Notas técnicas
- Idempotência garantida por `ON CONFLICT (documento_id, tarefa_id)` e pelo `NOT EXISTS` sobre `metadata->>'china_documento_id'`.
- Nenhuma alteração destrutiva: nada de `DELETE` fora do caminho já existente de `p_substituir`.
- Documentos sem `arquivo_path` continuam ignorados, como hoje.
