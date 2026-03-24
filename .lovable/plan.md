

# Analise Arquitetural e Sugestoes de Melhoria

## O que ja existe (bem construido)

O sistema ja implementa uma base solida com varios dos conceitos mencionados:

| Conceito | Status | Implementacao |
|----------|--------|---------------|
| Produto = Processo | ✅ Implementado | `product_process` + `process_events` + `process_step_history` |
| Timeline de auditoria | ✅ Implementado | `vw_process_timeline` + events unificados |
| SLA por etapa | ✅ Implementado | `tempo_permanencia_minutos` no step history |
| Despacho estruturado | ✅ Implementado | `useDespachoDocumentos` com modulos dinamicos, transicoes, parecer |
| Modulos de despacho dinamicos | ✅ Implementado | `process_modulos_despacho` (PM configura) |
| Controle UI granular (RBAC+ABAC) | ✅ Implementado | `ui_permissions` por role + departamento |
| Revisao bidirecional China↔Brasil | ✅ Implementado | `china_doc_revisoes` com contestacao |
| Cofre documental | ✅ Implementado | `china_cofre_produto` + versionamento |
| Retorno formal para China | ✅ Implementado | `devolvido_china` + `devolvido_china_data` no despacho |
| Consulta de Processos (e-SAJ) | ✅ Implementado | `ConsultaProcessos.tsx` |
| Pasta Digital (TJSP) | ✅ Implementado | `PastaDigitalFromChecklist` |

## Gaps reais identificados — 5 melhorias concretas

### 1. Tabela `process_decisions` — Decisao Internacional Formal

**O que falta**: Hoje a decisao do Brasil volta para China via update de status no documento (`devolvido_china`). Nao existe um registro formal de "decisao internacional" como entidade propria com versionamento.

**Proposta**: Criar tabela `process_decisions` que registra cada decisao formal (aprovado/rejeitado/ajuste) como entidade independente, com `version` e `parent_decision_id` para rastrear o loop de ida e volta.

```text
process_decisions
├── id, process_id, submissao_id
├── origin (brasil|china), destination (china|brasil)
├── decision_type (approved|rejected|needs_revision)
├── message (motivo obrigatorio)
├── items_affected (jsonb - lista de itens pendentes)
├── attachments (jsonb)
├── prazo_retorno (timestamp)
├── version (int, auto-increment por processo)
├── decided_by, decided_at
└── parent_decision_id (FK self-ref para rastrear o loop)
```

**Impacto**: A China ganha uma "Inbox de Decisoes do Brasil" com historico versionado, nao apenas um badge de status.

### 2. Permissoes por Etapa+Campo no Processo

**O que falta**: `ui_permissions` controla visibilidade por tela/role/departamento. Mas nao controla o que China vs Brasil pode fazer **por campo, por etapa do processo**. Hoje isso e implicito no codigo.

**Proposta**: Estender `ui_permissions` OU criar `process_field_permissions`:

```text
process_field_permissions
├── id, process_step (etapa)
├── module (ex: "fotos_produto", "formula")
├── field (ex: "upload_image", "edit_formula")
├── origin_role (china|brasil)
├── can_view, can_edit, can_approve
```

**Impacto**: Quando um processo volta para ajuste, o sistema automaticamente bloqueia campos ja aprovados e libera apenas os rejeitados — sem logica hardcoded.

### 3. Inbox de Retornos Estruturado na China

**O que falta**: A China ve status nos documentos, mas nao tem uma tela consolidada de "O que o Brasil decidiu e o que precisa ser corrigido".

**Proposta**: Criar componente `ChinaInboxDecisoes` que consome `process_decisions` e exibe:
- Decisao (aprovado/rejeitado/ajuste)
- Itens afetados com checklist
- Prazo de retorno
- Acao de "Reenviar" que cria nova versao

**Arquivo**: `src/components/china/ChinaInboxDecisoes.tsx`

### 4. Checklist de Retorno Inteligente

**O que falta**: Quando Brasil rejeita parcialmente, a China precisa reenviar tudo. Nao ha mecanismo de "reabrir apenas itens rejeitados".

**Proposta**: Ao criar uma `process_decision` com `needs_revision`, o sistema:
1. Marca documentos afetados como `aguardando_correcao`
2. Bloqueia edicao de documentos ja aprovados (via `process_field_permissions`)
3. Gera checklist automatico de pendencias na China

### 5. Padronizacao de Hooks e Queries

**Observacoes tecnicas**:
- Varios hooks usam `as any` cast extensivamente (ex: `china_doc_revisoes`, `product_process`). Isso indica que as tabelas nao estao sendo geradas nos types. Seria ideal rodar uma regeneracao de types para eliminar esses casts.
- O hook `useProductProcess` faz auto-create no `queryFn` (side-effect em query). Melhor separar em mutation explicita.
- `fetchAllRows` pattern (usado no Contas a Receber antigo) pode existir em outros modulos — auditar e substituir por RPCs.

## Prioridades Sugeridas

| Prioridade | Item | Esforco |
|------------|------|---------|
| 1 | `process_decisions` (tabela + migration) | Medio |
| 2 | Inbox de Decisoes na China (frontend) | Medio |
| 3 | Checklist de retorno inteligente | Baixo |
| 4 | `process_field_permissions` | Alto |
| 5 | Padronizacao de types/hooks | Baixo |

## Resumo

O sistema ja implementa ~80% do modelo conceitual descrito. As 5 melhorias acima fecham os gaps restantes, transformando o fluxo de "status updates" em um protocolo formal de tramitacao internacional com versionamento, permissoes granulares por etapa e inbox bidirecional.

