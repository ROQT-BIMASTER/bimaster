

## Análise: Produto como Processo — O que já existe vs. O que falta

### Diagnóstico

O sistema **já implementa ~80% do conceito** proposto, mas de forma **fragmentada por módulo**. Cada módulo tem seu próprio histórico isolado:

```text
HOJE (fragmentado):
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│ fabrica_produtos │  │ produto_brasil   │  │ china_produto       │
│ _historico       │  │ _historico       │  │ _documentos         │
│ (trigger-based)  │  │ (manual insert)  │  │ + pasta_digital     │
└─────────────────┘  └──────────────────┘  └─────────────────────┘
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│ produto_doc     │  │ fluxo_aprovacao  │  │ access_audit_log    │
│ _audit_log      │  │ _transicoes      │  │ (page tracking)     │
└─────────────────┘  └──────────────────┘  └─────────────────────┘

PROPOSTA (unificado):
┌─────────────────────────────────────────────────────────────────┐
│                    product_process                              │
│  → agrega TODOS os eventos de TODOS os módulos num só lugar    │
│  → timeline unificada "vida inteira do produto"                │
└─────────────────────────────────────────────────────────────────┘
```

### Mapeamento: Proposta vs. Existente

| Tabela proposta | Já existe como... | Gap |
|---|---|---|
| `product_process` | Status em `china_produto_submissoes` + `produtos_brasil` + `fabrica_produtos` | **Falta entidade unificada** |
| `process_events` | `fabrica_produtos_historico` (trigger), `produto_brasil_historico`, `produto_doc_audit_log` | **Fragmentado por módulo** |
| `process_documents` | `china_pasta_digital`, `china_produto_documentos`, `produto_documento_versoes` | Existe, mas isolado |
| `process_steps` | 12 estágios de ciclo de vida + `fluxo_aprovacao_etapas` | Existe |
| `process_step_history` | `fluxo_aprovacao_transicoes` | Parcial |

### O que precisa ser construído

**Não é criar tudo do zero** — é criar uma **camada de unificação** que agrega os dados existentes.

---

### Plano de Implementação

**1. Tabela `product_process` — Processo Unificado do Produto**

Entidade central que conecta um produto (de qualquer origem) ao seu processo completo:
- `id`, `produto_tipo` (china/brasil/fabrica), `produto_ref_id`, `status`, `etapa_atual`, `criado_por`, timestamps
- FK opcional para `china_produto_submissoes`, `produtos_brasil`, `fabrica_produtos`

**2. Tabela `process_events` — Timeline Unificada**

Evento universal que captura qualquer ação de qualquer módulo:
- `id`, `process_id`, `tipo_evento` (criacao, edicao, aprovacao, documento, etapa_change, despacho...), `descricao`, `modulo_origem` (china, brasil, fabrica, artes, regulatorio), `usuario_id`, `metadata` (JSONB), `created_at`
- Triggers nos módulos existentes fazem INSERT automático aqui (além dos históricos atuais)

**3. Tabela `process_step_history` — Rastreio por Etapa**

- `id`, `process_id`, `etapa` (text dos 12 estágios), `status`, `responsavel_id`, `data_inicio`, `data_fim`, `tempo_permanencia_minutos` (calculado)
- Permite calcular SLA e gargalos por etapa

**4. View `vw_process_timeline` — Agregação dos históricos existentes**

View SQL que faz UNION de todos os históricos existentes (`fabrica_produtos_historico`, `produto_brasil_historico`, `produto_doc_audit_log`, `fluxo_aprovacao_transicoes`) num formato padronizado, para retrocompatibilidade com dados já gerados.

**5. Componente `ProcessoTimeline.tsx` — Interface Unificada**

Timeline visual estilo jurídico mostrando a vida completa do produto:
- Ícones por tipo de evento (criação, documento, aprovação, rejeição, despacho)
- Filtro por módulo de origem
- Badge de etapa atual + tempo em cada fase
- Expandir/colapsar detalhes

**6. Triggers de integração**

Triggers em `fabrica_produtos_historico`, `produto_brasil_historico`, `produto_doc_audit_log` que automaticamente replicam para `process_events` — zero mudança nos fluxos existentes.

**7. Hook `useProductProcess.ts`**

CRUD do processo + query da timeline unificada + cálculo de SLA por etapa.

### Arquivos

| Arquivo | Ação |
|---|---|
| 1 migration SQL | Tabelas `product_process`, `process_events`, `process_step_history` + view + triggers + RLS |
| `src/hooks/useProductProcess.ts` | Hook de dados |
| `src/components/processo/ProcessoTimeline.tsx` | Timeline unificada |
| `src/components/processo/ProcessoResumo.tsx` | Card resumo (etapa atual, tempo, status) |
| Integração nas fichas existentes | Adicionar tab/seção nas páginas de detalhe |

### Benefício-chave

Nenhum módulo existente é alterado. A camada de processo é **aditiva** — captura dados dos triggers existentes e apresenta uma visão unificada. Os fluxos de Fábrica, China e Brasil continuam funcionando exatamente como estão.

