

# Plano OMS — Sistema de Gestao de Pedidos (Apartado da Fabrica)

## Entendimento do Contexto

O modulo "Fabrica" atual pertence a uma empresa separada do grupo, usada apenas para desenvolvimento de produtos e precificacao. O OMS proposto e um sistema **independente**, focado na operacao comercial da empresa principal, com alto volume (~2.000 pedidos/dia) e integracao bidirecional com:

- **Mercus** — Forca de vendas (entrada de pedidos)
- **Spark WMS** — Logistica, separacao, faturamento (emissao NF-e)
- **BiMaster** — Acompanhamento de estoque, credito, contas a receber

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUXO COMPLETO OMS                              │
│                                                                         │
│  MERCUS (Forca Vendas)                                                  │
│    │  API inbound: pedido.criado                                        │
│    ▼                                                                    │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐      │
│  │  ENTRADA DE  │───▸│  LIBERACAO DE    │───▸│  ENVIO AO WMS    │      │
│  │  PEDIDOS     │    │  CREDITO         │    │  (Spark)          │      │
│  │              │    │                  │    │                   │      │
│  │ - Validacao  │    │ - Limite disp.   │    │ - Webhook out:    │      │
│  │ - Duplicidade│    │ - Score/Bloqueio │    │   pedido.aprovado │      │
│  │ - Preco/Tab  │    │ - Fila manual    │    │                   │      │
│  └──────────────┘    └──────────────────┘    └─────────┬─────────┘      │
│                                                        │                │
│                                              Spark WMS processa:        │
│                                              Separacao → NF-e → Expedicao│
│                                                        │                │
│                                              API inbound de retorno:    │
│                                                        │                │
│                                                        ▼                │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                    RETORNO DO WMS                             │       │
│  │                                                              │       │
│  │  pedido.separado → atualiza status                           │       │
│  │  pedido.faturado → gera titulo em Contas a Receber           │       │
│  │                    (via fn_criar_titulo_receber existente)    │       │
│  │  pedido.expedido → atualiza tracking                         │       │
│  │  pedido.entregue → fecha ciclo                               │       │
│  │                                                              │       │
│  │  Movimentacao de estoque:                                    │       │
│  │  - Recebimento MP via XML (reutiliza parser NF-e existente)  │       │
│  │  - Saidas por faturamento WMS                                │       │
│  │  - Saldos em tempo real                                      │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  IVA Dual: reutiliza fabrica_tax_rates_iva + triggers existentes        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Fases de Implementacao

### FASE 1 — Core OMS (Tabelas + Telas de Gestao)

**Objetivo**: Infraestrutura de pedidos com capacidade para 2K/dia

**Tabelas novas** (prefixo `oms_`):
- `oms_pedidos` — cabecalho (numero, cliente, vendedor, empresa, tabela_preco, condicao_pagamento, status, valor_total, canal_origem)
- `oms_pedido_itens` — itens (produto, quantidade, preco, desconto)
- `oms_pedido_status_log` — timeline de transicoes com timestamp e usuario
- `oms_condicoes_pagamento` — cadastro de condicoes (a vista, 30/60, etc.)

**Indices para performance** (2K pedidos/dia = ~60K/mes):
- Index composto em `(status, created_at)` para filas
- Index em `(cliente_codigo, created_at)` para historico
- Index em `(empresa_id, status)` para multi-tenant
- Particao por mes em `oms_pedido_status_log` (volume alto de logs)

**Status do pedido**:
`recebido` → `credito_pendente` → `credito_aprovado` → `enviado_wms` → `separando` → `faturado` → `expedido` → `entregue` (ou `rejeitado`/`cancelado`)

**Telas**:
- `OmsPainelPedidos` — Painel gerencial com KPIs, filtros por status/vendedor/empresa, paginacao server-side
- `OmsPedidoDetalhe` — Detalhe do pedido com timeline de status, itens, dados fiscais
- `OmsCondicoesPagamento` — Cadastro de condicoes

### FASE 2 — Integracao Mercus (Inbound API)

**Objetivo**: Receber pedidos da forca de vendas Mercus via API

**Edge Function `oms-inbound-api`**:
- Endpoint POST para recepcao de pedidos
- Autenticacao via API Key (mesmo padrao Huggs)
- Validacao: duplicidade (idempotency key), cliente existe, produtos existem, tabela de preco valida
- Mapeamento de campos Mercus → `oms_pedidos` + `oms_pedido_itens`
- Rate limit adequado para volume (2K/dia ≈ 1.4/min, com picos)

**Tela**:
- `OmsMonitorIntegracao` — Monitor de recepcao com status, erros, reenvio

### FASE 3 — Liberacao de Credito

**Objetivo**: Aprovacao automatica/manual baseada no perfil de credito existente

**Reutiliza**: `clientes_perfil_credito` (limite, utilizado, disponivel, score, bloqueio)

**Logica**:
- Automatica: `limite_disponivel >= valor_pedido` AND `bloqueio = false` → aprova direto
- Manual: Fila para analista quando limite insuficiente, inadimplencia ou score baixo
- Atualizacao do `limite_utilizado` ao aprovar

**Telas**:
- `OmsLiberacaoCredito` — Fila de pendentes com perfil do cliente e historico

### FASE 4 — Integracao Spark WMS (Bidirecional)

**Objetivo**: Enviar pedidos aprovados e receber retornos de status/faturamento

**Outbound (BiMaster → Spark)**:
- Reutiliza arquitetura de webhooks existente (`webhook_event_queue` + `webhook-dispatcher`)
- Eventos: `pedido.credito_aprovado`, `pedido.cancelado`

**Inbound (Spark → BiMaster)**:
- Edge Function `oms-wms-inbound`
- Eventos: `pedido.separado`, `pedido.faturado`, `pedido.expedido`, `pedido.entregue`
- **Evento critico `pedido.faturado`**: extrai dados fiscais (NF-e) e gera titulo automatico em Contas a Receber via `fn_criar_titulo_receber` existente
- Movimentacao de estoque: registra saidas em `estoque_movimentacoes`

### FASE 5 — Estoque OMS (Apartado da Fabrica)

**Objetivo**: Gestao de estoque independente com recebimento via XML

**Tabelas** (reutiliza estrutura existente de estoque):
- Registros em `estoque_movimentacoes` com `origem = 'oms'` para separar da fabrica
- Tipo "reserva" para pedidos aprovados, "saida_faturamento" para pedidos faturados
- Recebimento de MP via XML reutiliza `nfe-xml-parser.ts` existente

**Compliance fiscal**:
- Reutiliza `fabrica_tax_rates_iva` para calculos de CBS/IBS
- Triggers de calculo fiscal aplicam-se aos novos documentos

### FASE 6 — Modulo de Permissoes

**Novo modulo** no sistema RBAC:
- Codigo: `oms`
- Telas: `oms_painel`, `oms_detalhe`, `oms_credito`, `oms_monitor`, `oms_estoque`, `oms_condicoes`
- Registrar em `modulos` e `telas` via migration

## Arquivos por Fase

**Fase 1**:
| Arquivo | Acao |
|---------|------|
| Migration SQL | CREATE 4 tabelas + indices + RLS + realtime |
| `src/pages/OmsPainelPedidos.tsx` | Painel com grid paginado server-side |
| `src/pages/OmsPedidoDetalhe.tsx` | Detalhe + timeline |
| `src/pages/OmsCondicoesPagamento.tsx` | CRUD condicoes |
| `src/hooks/useOmsPedidos.ts` | Queries com paginacao |
| Rotas em App.tsx | `/dashboard/oms/*` |

**Fase 2**:
| Arquivo | Acao |
|---------|------|
| `supabase/functions/oms-inbound-api/index.ts` | API recepcao Mercus |
| `src/pages/OmsMonitorIntegracao.tsx` | Monitor |

**Fase 3**:
| Arquivo | Acao |
|---------|------|
| `src/pages/OmsLiberacaoCredito.tsx` | Fila de aprovacao |
| `src/hooks/useOmsCredito.ts` | Logica de credito |

**Fase 4**:
| Arquivo | Acao |
|---------|------|
| `supabase/functions/oms-wms-inbound/index.ts` | Recepcao Spark |
| Migration SQL | Novos event types no webhook system |

**Fase 5**:
| Arquivo | Acao |
|---------|------|
| Migration SQL | Novos tipos de movimentacao |
| `src/pages/OmsEstoque.tsx` | Visao de estoque OMS |

**Fase 6**:
| Arquivo | Acao |
|---------|------|
| Migration SQL | INSERT em modulos + telas |

## Recomendacao

Comecar pela **Fase 1** (tabelas + painel de gestao) para validar a estrutura de dados com volume real. Fase 2 (Mercus) e a integracao mais critica para operacao — sem ela nao ha entrada de pedidos. Fases 3-5 adicionam automacao sobre a base funcional.

