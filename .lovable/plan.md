

# Auto-Carregar Regras de Aprovacao na Extracao de Documentos

## Problema

Ao extrair ingredientes de um documento do processo, o sistema nao carrega nem associa as regras de aprovacao configuradas na etapa "Vincular China". O documento despachado possui um `workflow_config_id` na tabela `process_despacho_documento`, mas essa informacao e ignorada durante a extracao.

## Solucao

### 1. Carregar regras de aprovacao junto com os documentos do processo

No `loadProcessoDocs`, alem de buscar os vinculos em `china_documento_tarefa_vinculos`, buscar tambem os registros de `process_despacho_documento` para cada documento, trazendo:
- `workflow_config_id` (fluxo configurado)
- `modulo_destino` (modulo de destino)
- `status` do despacho
- `etapa_atual`

Com o `workflow_config_id`, buscar o nome do fluxo em `process_doc_workflow_config` e as etapas em `process_doc_workflow_etapas` (aprovadores, departamentos, tipo de acao).

### 2. Exibir regras de aprovacao no Step 2 (Analisar & Aceitar)

Abaixo do preview do documento e acima do Termo de Responsabilidade, exibir um card informativo com:
- Nome do fluxo de aprovacao vinculado
- Lista das etapas com aprovadores e tipo de acao
- Badge indicando a etapa atual do documento no fluxo

Isso garante que o usuario visualiza as regras ANTES de extrair.

### 3. Vincular regras ao resultado da extracao

Ao confirmar os ingredientes (Step 3), incluir nos metadados de auditoria:
- `workflow_config_id`
- `despacho_id` (da `process_despacho_documento`)
- `documento_id` original (imutavel)
- `etapa_atual` no momento da extracao

Tambem propagar o `workflow_config_id` e `despacho_documento_id` nos itens criados via `onIngredientesExtraidos`, para que o modulo Composicao saiba qual fluxo governa aqueles ingredientes.

### 4. Garantir imutabilidade do vinculo documento-regras

O `documento_id` original e o `workflow_config_id` sao registrados como metadados somente-leitura no audit log. Nenhuma acao do usuario pode alterar a associacao entre o documento original e suas regras de aprovacao apos a extracao.

### 5. Audit trail completo

Expandir o log de auditoria existente para incluir:
- `workflow_config_id` e `workflow_nome`
- `despacho_documento_id`
- `etapas_aprovacao` (snapshot das etapas no momento)
- `documento_original_id` (referencia imutavel)

## Arquivo Afetado

| Arquivo | Acao |
|---------|------|
| `src/components/composicao/ExtrairIngredientesIADialog.tsx` | Carregar despacho/workflow ao listar docs; exibir regras no Step 2; propagar metadados na confirmacao; audit expandido |

## Detalhes Tecnicos

```text
loadProcessoDocs():
  1. china_documento_tarefa_vinculos → docIds
  2. china_produto_documentos WHERE id IN docIds
  3. process_despacho_documento WHERE documento_id IN docIds → workflow_config_id
  4. process_doc_workflow_config WHERE id = workflow_config_id → nome
  5. process_doc_workflow_etapas WHERE config_id = workflow_config_id → etapas[]

Cada doc no estado tera:
  { ...doc, checklists, despacho: { id, workflow_config_id, etapa_atual, status }, workflow: { nome, etapas[] } }
```

Nenhuma migration necessaria — todas as tabelas ja existem.

