# Integration tests — `rpc_comentar_item_aprovacao`

Suíte SQL admin-only que valida a RPC de comentários de itens de aprovação,
incluindo o uso correto de `created_by` (regressão fixada em 2026-05-04).

## Como rodar

Em um SQL client conectado como admin (ou via `psql` no sandbox Lovable Cloud):

```sql
-- Caller já é admin (psql/IDE com sessão admin):
SELECT public.test_rpc_comentar_item_aprovacao();

-- Ou passe o UUID de um admin explicitamente (útil em superuser/psql sem JWT):
SELECT public.test_rpc_comentar_item_aprovacao('<admin-uuid>');
```

Retorno esperado: `OK: 7/7 asserções passaram`. Qualquer falha levanta `RAISE
EXCEPTION` com o número da asserção (T1–T7) e a causa.

## Asserções cobertas

| # | Cenário | Esperado |
|---|---|---|
| T1 | Comentário só com espaços | Bloqueado com mensagem `vazio`. |
| T2 | Comentário com 4001 caracteres | Bloqueado com `muito longo`. |
| T3 | `p_item_id` inexistente | Bloqueado com `não encontrado`. |
| T4 | Usuário sem permissão (não-admin, não-criador, não-responsável, não-membro) | Bloqueado com `Sem permissão`. |
| T5 | **Criador** (`created_by`) comenta | RPC retorna UUID, `aprovacao_kanban_audit` recebe linha com `user_id = created_by`, `acao='comentario'`, `origem='comentario'`, texto e `item_id` corretos. |
| T6 | **Responsável atual** comenta | Linha persistida com `user_id = responsavel_atual_id`. |
| T7 | Total de comentários no item | Exatamente 2. |

## Como funciona

A função roda como `SECURITY DEFINER`, simula usuários trocando o GUC
`request.jwt.claim.sub` (que `auth.uid()` lê) e cria fixtures **mínimas**:

- Reaproveita `documento_id`, `pipeline_id`, `etapa_atual_id` de um item existente
  (FKs apontam para `china_produto_documentos`, `fluxo_aprovacao_config` e
  `fluxo_aprovacao_etapas` — criar do zero seria caro).
- Cria UM item temporário em `aprovacao_documento_itens` **sem `projeto_id`**
  (para que a permissão por `projeto_membros` não interfira).
- Ao final, remove o item, suas linhas em `aprovacao_kanban_audit` e
  `notificacoes` geradas.

Não toca em dados de produção.

## Quando rodar

- Após qualquer alteração em `public.rpc_comentar_item_aprovacao`.
- Em revisões de RLS/SECURITY DEFINER que mexam em `aprovacao_documento_itens`
  ou `aprovacao_kanban_audit`.
- Como smoke-test depois de migrations grandes no módulo Aprovações.

## Regressão fixada

A versão anterior da RPC referenciava `v_item.criado_por` (coluna inexistente)
ao validar a permissão do criador. O T5 garante que o caminho correto agora é
`v_item.created_by` — qualquer regressão volta a quebrar.
