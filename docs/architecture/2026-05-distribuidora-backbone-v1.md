# Bimaster — Documentação de Arquitetura: Espinha Dorsal de Distribuição
**Versão:** 1.0 · **Data:** 2026-05-22 · **Status:** Para revisão por Arquitetura/Engenharia
**Repositório:** bimaster (Lovable + GitHub sync bidirecional) · **Backend:** Lovable Cloud (Supabase gerenciado)

> Este documento é a fonte canônica de planejamento da próxima onda do Bimaster: **Espinha Dorsal de Distribuição**. Foi escrito para ser revisado por arquitetos e engenheiros externos. Indica caminhos do repositório que podem ser inspecionados por agentes (Cloud Code, Claude Code, Cursor) para validar o que está implementado vs. o que está planejado.

---

## Sumário

1. [Visão e escopo](#1-visão-e-escopo)
2. [Princípios de engenharia](#2-princípios-de-engenharia)
3. [Inventário do que já existe](#3-inventário-do-que-já-existe-reaproveitar)
4. [Arquitetura-alvo da Distribuidora](#4-arquitetura-alvo-da-distribuidora)
5. [Decisões pendentes](#5-decisões-pendentes-bloqueiam-f0)
6. [Roadmap por fase (F0–F7)](#6-roadmap-por-fase-f0f7)
7. [Modelo de dados detalhado](#7-modelo-de-dados-detalhado)
8. [Edge Functions / APIs](#8-edge-functions--apis)
9. [Frontend: telas, fluxos e padrões](#9-frontend-telas-fluxos-e-padrões)
10. [Segurança em camadas](#10-segurança-em-camadas)
11. [Estratégia anti-quebra de produção](#11-estratégia-anti-quebra-de-produção)
12. [Integração Protheus (placeholder)](#12-integração-protheus-placeholder)
13. [Observabilidade e SRE](#13-observabilidade-e-sre)
14. [Testes, QA, CI/CD](#14-testes-qa-cicd)
15. [Mapa de caminhos para auditoria externa](#15-mapa-de-caminhos-para-auditoria-externa)
16. [Glossário](#16-glossário)
17. [Anexos](#17-anexos)

---

## 1. Visão e escopo

### 1.1 Contexto de negócio
A Bimaster opera uma cadeia composta por:
- **Fábrica Brasil (BR)** — produção nacional, atualmente com **Protheus** como SoR fiscal.
- **Fábrica China (CN)** — produção/importação que **fatura direto às Distribuidoras** (não passa pela Fábrica BR).
- **Distribuidoras regionais** (União MG, União PR, etc.) — recebem, estocam, vendem, faturam e expedem aos clientes finais.
- **Forças de venda externas (SFA)** — Mercos como primeiro provider; pedidos entram via API.
- **Clientes finais** — varejo, distribuidores menores, e-commerce.

### 1.2 Escopo desta onda (foco atual)
Construir a **espinha dorsal operacional da Distribuidora**:

```text
RECEBIMENTO -> ESTOQUE/KARDEX -> WMS -> PEDIDO -> CREDITO ->
RESERVA -> SEPARACAO -> FATURAMENTO -> EXPEDICAO -> TRACKING
```

### 1.3 Fora de escopo (planejamento separado)
- Integração ativa com **Protheus** (apenas placeholder; ver §12).
- Módulos administrativos já existentes (PLM, custos, MRP, financeiro DRE) — permanecem como **Polo Administrativo**, integrados via eventos.

### 1.4 Não-objetivos
- Refazer multi-tenant (já existe `EmpresaContext` + `user_empresas`).
- Refazer auth, roles, MFA, secure-handler (já maduros).
- Refazer parser de NF-e (`src/lib/fabrica/nfe-xml-parser.ts` é canônico).

---

## 2. Princípios de engenharia

> **Toda nova tabela, função, tela ou edge tem porquê documentado e reaproveita o que existe.** Antes de criar, mapear. Antes de duplicar, canonizar.

1. **Expand → Migrate → Contract** em todas as refatorações estruturais.
2. **Feature flags por empresa** (`empresas_flags`) — default OFF; rollout em piloto antes de geral.
3. **Shadow write** quando refatorar tabelas com dados de produção; comparação de drift antes do cutover.
4. **Idempotência** em toda operação que cruza fronteira (webhook, retry, integração).
5. **Outbox/Inbox pattern** (já existe `integration_queue/configs/logs`) para qualquer integração externa.
6. **RLS por `empresa_id`** em 100% das tabelas novas; semi-joins (sem função SQL pesada).
7. **Sem credenciais hardcoded; sem `localStorage` para autorização.**
8. **Zod `.strict()`** em todo input de edge.
9. **`secureHandler`** obrigatório em toda edge.
10. **Observabilidade desde o dia 1** — logs estruturados, métricas, alertas.

---

## 3. Inventário do que já existe (reaproveitar)

Mapeado em 2026-05-22 via `information_schema` e listagem de páginas.

### 3.1 Banco — tabelas relevantes já criadas
| Tabela | Função atual | Ação proposta |
|---|---|---|
| `empresas` | Cadastro de tenants | Adicionar coluna `tipo` (`fabrica_br`,`fabrica_cn`,`distribuidora`,`terceiro`) |
| `user_empresas`, `user_empresa_access` | Vínculo usuário<->tenant | Manter; base de toda RLS |
| `user_roles` + `has_role(uuid, app_role)` | Autorização | Manter (canônico) |
| `estoque_distribuidoras` | Cadastro de distribuidora | Vincular 1:1 a `empresas.id` via FK |
| `estoque_movimento` **e** `estoque_movimentacoes` | Kardex (DUPLICADO) | **Decisão crítica**: eleger 1 canônica, view de compat na outra, trigger `RAISE` na descontinuada |
| `estoque_saldos`, `estoque_produto_nivel`, `estoque_lote_interno`, `estoque_produtos_master`, `estoque_produtos_distribuidora` | Saldos/níveis/lotes | Padronizar PK `(empresa_id, produto_id, deposito_id, lote_id)` |
| `estoque_unificado_cache`, `estoque_sync_logs` | Cache + auditoria de sync | Base do futuro espelho Protheus |
| `recebimentos` | Recebimento de NF | **Promover** a entidade-mãe (`recebimentos` + filhos a criar) |
| `fabrica_notas_fiscais` **e** `fabrica_notas_fiscais_saida` (DUPLICADO) | NF da fábrica | Decidir canônica + view de compat |
| `integration_configs`, `integration_queue`, `integration_logs`, `integration_field_mappings` | Hub de integração genérico | Base de SFA inbound, Protheus futuro, WMS provider, FiscalProvider |

### 3.2 Edge functions reutilizáveis
- `supabase/functions/process-nfe-xml` — parser de NF-e XML (já em produção).
- `supabase/functions/estoque-api` — endpoint REST de estoque.
- `supabase/functions/estoque-n8n-sync` — sync com n8n.
- `supabase/functions/_shared/secure-handler.ts` — pipeline de segurança canônico.
- `supabase/functions/_shared/ai-gateway-call.ts` — chamada IA com fallback.
- `supabase/functions/_shared/idempotency.ts` — idempotency-key store.
- `supabase/functions/_shared/timing-safe.ts` — HMAC validation.
- `supabase/functions/_shared/ssrf-guard.ts` — outbound fetch protection.

### 3.3 Bibliotecas frontend reutilizáveis
- `src/lib/fabrica/nfe-xml-parser.ts` — parsing de XML NF-e no browser.
- `src/lib/ai/invokeChat.ts` — chamada IA com timeout/tradução de erros.
- `src/lib/utils/parseLocalDate.ts` — leitura segura de `DATE`.
- `src/lib/formatters.ts` — `formatCurrency`.
- `src/components/common/StoragePreviewDialog.tsx` — download seguro.
- `src/components/ui/DecimalInput.tsx` — input numérico 4 casas.
- `src/contexts/EmpresaContext.tsx` — escopo multi-tenant ativo.

### 3.4 Padrões de processo já consolidados
- `docs/onboarding/` (14 arquivos) — fonte canônica.
- `mem://index.md` — regras core sempre em contexto.
- CI: `regression-greps`, `security-rls-e2e`, `guard-destructive-migrations`.
- `docs/incidents/2026-05-16-fabrica-br-data-loss.md` — política anti-DROP.

### 3.5 O que **não** existe ainda
- WMS de endereçamento (rua/coluna/nível/posição).
- Tabela de pedido de venda (OMS) na distribuidora.
- Tabela de cliente da distribuidora.
- Análise de crédito automatizada.
- Reserva de estoque como conceito de primeira classe.
- Onda de separação, packing, romaneio.
- FaturamentoProvider externo (Focus NFe / NFE.io / etc.).
- Tracking de entrega ao cliente final.

---

## 4. Arquitetura-alvo da Distribuidora

### 4.1 Fluxo macro

```text
        +--- XML 3o ----+   +-- Fabrica CN --+   +-- Fabrica BR --+
        |               |   | (DI + NF CN)   |   | (placeholder)  |
        v               v   v                v   v                v
   +--------------------------------------------------------------+
   |  1. RECEBIMENTO                                              |
   |  recebimentos + recebimento_itens + recebimento_divergencias |
   |  Reuso: process-nfe-xml + nfe-xml-parser                     |
   +-----------------------------------+--------------------------+
                                       v
   +--------------------------------------------------------------+
   |  2. ESTOQUE / KARDEX  (canonico unico)                       |
   |  estoque_movimento + estoque_saldos                          |
   |  18 tipos de movimento; vw_kardex_produto                    |
   +-----------------------------------+--------------------------+
                                       v
   +--------------------------------------------------------------+
   |  3. WMS interno                                              |
   |  wms_endereco + wms_endereco_saldo + wms_tarefa              |
   |  Estrategias FIFO/FEFO; coletor mobile-web                   |
   +--------------------+--------------+--------------------------+
                        |              |
   SFA externa -----> +-v---------------------+
   (Mercos)           | 4. PEDIDO INBOUND (OMS)|
                      | oms_pedido + itens     |
                      | HMAC + idempotency-key |
                      +----------+-------------+
                                 v
                      +--------------------------+
                      | 5. CREDITO + POLITICA    |
                      | crd_politica + crd_analise|
                      | Manual no MVP; IA fase 4b|
                      +----------+---------------+
                                 v
                      +--------------------------+
                      | 6. RESERVA DE SALDO      |
                      | saldo comprometido       |
                      +----------+---------------+
                                 v
                      +--------------------------+
                      | 7. SEPARACAO / PACKING   |
                      | ondas, picking, volumes  |
                      +----------+---------------+
                                 v
                      +--------------------------+
                      | 8. FATURAMENTO           |
                      | FaturamentoProvider      |
                      | Focus NFe / NFE.io       |
                      +----------+---------------+
                                 v
                      +--------------------------+
                      | 9. EXPEDICAO + TRACKING  |
                      | romaneio, rastreio, OTIF |
                      +--------------------------+
```

### 4.2 Eventos publicados (outbox)
Todo passo do fluxo grava um evento em `integration_outbox` para consumidores internos (Polo Admin: margem, financeiro AR, MRP) e externos (SFA: status do pedido).

| Evento | Origem | Consumidor |
|---|---|---|
| `recebimento.confirmado` | F1 | Polo Admin (custo médio), F2 |
| `estoque.movimento.gerado` | F2 | Dashboards, analytics |
| `pedido.recebido` | F4 | Auditoria, SFA |
| `pedido.credito_aprovado` | F4 | F5 (reserva) |
| `pedido.credito_negado` | F4 | SFA (Mercos), CRM |
| `pedido.reservado` | F5 | F6 (separação) |
| `pedido.faturado` | F6 | Financeiro AR, SFA |
| `pedido.expedido` | F7 | Cliente, SFA |
| `pedido.entregue` | F7 | NPS, KPI OTIF |

### 4.3 Stack técnica (sem mudança)
Conforme `AGENTS.md`: React 18 + Vite 5 + TS 5.8 + Tailwind 3 + shadcn/ui + TanStack Query 5 + Zod 3 (`.strict()`) + Supabase JS 2 + Edge Deno + Bun.

---

## 5. Decisões pendentes (bloqueiam F0)

| # | Decisão | Sugestão default |
|---|---|---|
| 1 | Kardex canônico: `estoque_movimento` vs `estoque_movimentacoes` | Eleger a com maior volume de escrita atual; outra vira view de compat |
| 2 | NF Fábrica canônica: `fabrica_notas_fiscais` vs `fabrica_notas_fiscais_saida` | Unificar em `fabrica_notas_fiscais` com coluna `tipo_operacao` (entrada/saída) |
| 3 | Enum `empresas.tipo` aceito? | `('fabrica_br','fabrica_cn','distribuidora','terceiro')` |
| 4 | Provider fiscal inicial | Focus NFe (mais maduro no PT-BR) |
| 5 | WMS inicial | **Interno** (endereçamento simples); adapter pronto para 3PL futuro |
| 6 | Saldo exposto à SFA | `livre - reservado` (mais conservador) |
| 7 | Crédito IA no MVP? | **Não**. 100% manual em F4; IA atrás de flag em F4b |
| 8 | Importador legal CN | Cada distribuidora importa direto **OU** trading BR (define quem emite NF de saída) |
| 9 | WhatsApp transacional | Z-API (custo mais baixo no BR) |
| 10 | SPED provider | Mesmo provider fiscal (Focus NFe oferece SPED) |
| 11 | Quarentena CN obrigatória? | Apenas regulados ANVISA (cosméticos) |

---

## 6. Roadmap por fase (F0–F7)

Cada fase: atrás de **feature flag**, rollout em **1 distribuidora-piloto** antes de geral, com release sem incidente.

### F0 — Saneamento e contratos (2 sprints · risco BAIXO)
- Aprovar §5 (11 decisões).
- Migration: `empresas.tipo` + backfill.
- Canonização Kardex (view de compat + trigger na descontinuada).
- Canonização NF fábrica.
- Documentos: `docs/onboarding/16-DISTRIBUIDORA-BACKBONE.md`, `17-EVENT-CONTRACT.md`, `18-PROTHEUS-PLACEHOLDER.md`.
- Diagrama mermaid oficial.
- Feature flags: `ff_wms_v1`, `ff_oms_pedido_v1`, `ff_credito_v1`, `ff_faturamento_externo_v1`, `ff_sfa_inbound_v1`, `ff_credito_ia_v1`.

### F1 — Recebimento unificado (3 sprints · risco MÉDIO)
- Tabelas: `recebimento_itens`, `recebimento_divergencias`, `recebimento_anexos`, `recebimento_status_hist`, `recebimento_quarentena`.
- Origens: XML 3º, CN (DI), upload manual de XML "Fábrica BR" (placeholder Protheus).
- Reuso integral: `process-nfe-xml`, `nfe-xml-parser`.
- Conferência cega (operador não vê quantidade esperada).
- Quarentena para SKUs regulados.
- Entrada gera movimento no Kardex canônico.
- Telas: §9.1.

### F2 — Estoque multi-depósito + Kardex (3 sprints · risco MÉDIO)
- `est_deposito` (principal, devolução, avaria, quarentena, trânsito).
- 18 tipos de movimento padronizados.
- `vw_kardex_produto` materializada com refresh incremental.
- Saldo comprometido como conceito de 1ª classe.
- Shadow write + job de drift.

### F3 — WMS interno (3 sprints · risco MÉDIO)
- `wms_endereco`, `wms_endereco_saldo`, `wms_tarefa`, `wms_tarefa_log`.
- Estratégias FIFO/FEFO.
- App de coletor (web mobile-first) com bipagem.
- Contrato `WMSProvider` pronto para futuro 3PL externo.

### F4 — OMS de Pedido + Crédito (4 sprints · risco ALTO)
- Tabelas: `cli_cliente`, `oms_pedido`, `oms_pedido_item`, `oms_pedido_status_hist`, `crd_politica`, `crd_analise`, `crd_score_cliente`.
- Endpoint `api-orders-inbound` (HMAC + idempotency-key).
- Crédito manual no MVP; IA Gemini Flash em sub-fase 4b.
- Reserva automática na aprovação.
- Kanban `/comercial/pedidos`.

### F5 — Separação + Faturamento + Expedição (4 sprints · risco ALTO)
- `exp_onda`, `exp_volume`, `exp_romaneio`, `fat_nota_emitida`.
- Adapter `FaturamentoProvider` (Focus NFe primeiro).
- Baixa de estoque por **NF emitida** (não por separação).
- Tracking público por token (padrão SECURITY DEFINER existente).
- Evento `pedido.status_alterado` para SFA.

### F6 — Comunicação + Portal cliente (2 sprints · risco BAIXO)
- WhatsApp transacional (Z-API).
- Portal do cliente da distribuidora: pedidos, NFs, boletos, rastreio.

### F7 — Espelho Fábrica BR via upload manual (1 sprint · risco BAIXO)
- Tela "Recebimentos por origem Fábrica BR" — upload manual de XML.
- Campo `recebimentos.origem_externa = 'protheus_manual'`.
- Doc `18-PROTHEUS-PLACEHOLDER.md` registrando integração futura.

---

## 7. Modelo de dados detalhado

> Todas as tabelas: PK UUID; `empresa_id UUID NOT NULL`; `created_at/updated_at TIMESTAMPTZ` + trigger `set_updated_at`; RLS habilitada com policy semi-join via `user_empresas`.

### 7.1 F0 — Saneamento
```sql
CREATE TYPE empresa_tipo AS ENUM ('fabrica_br','fabrica_cn','distribuidora','terceiro');
ALTER TABLE empresas ADD COLUMN tipo empresa_tipo;
-- backfill por dados existentes; depois NOT NULL

CREATE TABLE empresas_flags (
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  flag text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (empresa_id, flag)
);
```

### 7.2 F1 — Recebimento
```sql
ALTER TABLE recebimentos
  ADD COLUMN origem_externa text,  -- 'xml_terceiro','cn_di','protheus_manual'
  ADD COLUMN status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN chave_nfe text,
  ADD COLUMN xml_storage_path text;

CREATE TABLE recebimento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  lote text, validade date,
  qtd_esperada numeric(18,4) NOT NULL,
  qtd_conferida numeric(18,4),
  unidade text NOT NULL,
  custo_unitario numeric(18,4),
  empresa_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE recebimento_divergencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_item_id uuid NOT NULL REFERENCES recebimento_itens(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'falta','sobra','avaria','validade','lote'
  descricao text, foto_storage_path text,
  resolvida boolean DEFAULT false,
  empresa_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE recebimento_status_hist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  status_de text, status_para text NOT NULL,
  motivo text, user_id uuid,
  empresa_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### 7.3 F2 — Estoque
```sql
CREATE TABLE est_deposito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  tipo text NOT NULL, -- 'principal','devolucao','avaria','quarentena','transito'
  ativo boolean DEFAULT true,
  UNIQUE (empresa_id, codigo)
);

-- 18 tipos: entrada_nf, transferencia_saida, transferencia_entrada,
--   ajuste_positivo, ajuste_negativo, reserva, baixa_reserva,
--   baixa_faturamento, devolucao_cliente, devolucao_fornecedor,
--   perda, quebra, validade, inventario_positivo, inventario_negativo,
--   producao_entrada, producao_saida, requisicao_interna

CREATE MATERIALIZED VIEW vw_kardex_produto AS
SELECT produto_id, empresa_id, deposito_id,
       SUM(CASE WHEN tipo IN (...) THEN qtd ELSE -qtd END) AS saldo
FROM estoque_movimento GROUP BY 1,2,3;
```

### 7.4 F3 — WMS
```sql
CREATE TABLE wms_endereco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  deposito_id uuid NOT NULL REFERENCES est_deposito(id),
  rua text NOT NULL, coluna text NOT NULL,
  nivel text NOT NULL, posicao text NOT NULL,
  tipo text NOT NULL, -- 'pulmao','picking','recebimento','expedicao'
  capacidade_volume numeric(12,4),
  UNIQUE (empresa_id, deposito_id, rua, coluna, nivel, posicao)
);

CREATE TABLE wms_endereco_saldo (
  endereco_id uuid REFERENCES wms_endereco(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL, lote text,
  quantidade numeric(18,4) NOT NULL DEFAULT 0,
  empresa_id uuid NOT NULL,
  PRIMARY KEY (endereco_id, produto_id, lote)
);

CREATE TABLE wms_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tipo text NOT NULL, -- 'put_away','picking','packing','transferencia'
  origem_endereco_id uuid REFERENCES wms_endereco(id),
  destino_endereco_id uuid REFERENCES wms_endereco(id),
  produto_id uuid NOT NULL, lote text,
  quantidade numeric(18,4) NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  pedido_id uuid, operador_id uuid,
  created_at timestamptz DEFAULT now(),
  iniciada_at timestamptz, concluida_at timestamptz
);
```

### 7.5 F4 — OMS + Crédito
```sql
CREATE TABLE cli_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  grupo_economico_id uuid, vendedor_id uuid,
  status text NOT NULL DEFAULT 'ativo',
  UNIQUE (empresa_id, cnpj)
);

CREATE TABLE oms_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  numero_externo text,
  origem text NOT NULL, -- 'sfa_mercos','manual','portal_cliente'
  cliente_id uuid NOT NULL REFERENCES cli_cliente(id),
  vendedor_id uuid,
  valor_total numeric(18,2) NOT NULL,
  status text NOT NULL DEFAULT 'recebido',
  observacao_integracao_protheus text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, origem, numero_externo)
);

CREATE TABLE oms_pedido_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES oms_pedido(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  quantidade numeric(18,4) NOT NULL,
  preco_unitario numeric(18,4) NOT NULL,
  desconto_pct numeric(5,2) DEFAULT 0,
  empresa_id uuid NOT NULL
);

CREATE TABLE crd_politica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  escopo text NOT NULL, -- 'global','grupo','cliente'
  escopo_id uuid,
  limite_credito numeric(18,2) NOT NULL,
  prazo_max_dias int NOT NULL,
  vigente boolean DEFAULT true
);

CREATE TABLE crd_analise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES oms_pedido(id) ON DELETE CASCADE,
  decisao text NOT NULL, -- 'aprovado','negado','pendente'
  motivo text,
  decidido_por uuid,
  decidido_por_ia boolean DEFAULT false,
  score numeric(5,2),
  empresa_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### 7.6 F5 — Expedição + Faturamento
```sql
CREATE TABLE exp_onda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo text NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE exp_volume (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES oms_pedido(id),
  onda_id uuid REFERENCES exp_onda(id),
  peso_kg numeric(10,3),
  cubagem_m3 numeric(10,4),
  empresa_id uuid NOT NULL
);

CREATE TABLE fat_nota_emitida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES oms_pedido(id),
  provider text NOT NULL, -- 'focus_nfe','nfe_io'
  chave_nfe text NOT NULL,
  numero int NOT NULL, serie int NOT NULL,
  xml_storage_path text NOT NULL,
  pdf_storage_path text,
  status text NOT NULL,
  empresa_id uuid NOT NULL,
  emitida_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, chave_nfe)
);
```

### 7.7 RLS — padrão único
```sql
ALTER TABLE oms_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros leem pedidos da empresa"
ON oms_pedido FOR SELECT TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()));
-- repetir padrão em insert/update/delete com checks adequados
```

---

## 8. Edge Functions / APIs

### 8.1 Novas funções (Deno + secureHandler obrigatório)
| Função | Auth | Rate-limit | Propósito |
|---|---|---|---|
| `recebimento-process-xml` | jwt | 30/min | Upload manual de XML; reusa parser |
| `api-orders-inbound` | apikey + HMAC | 120/min | SFA -> cria `oms_pedido` |
| `pedido-credit-analyze` | jwt | 60/min | Aciona análise crédito; opcional IA |
| `faturamento-emit-nfe` | jwt | 30/min | Chama FaturamentoProvider |
| `wms-task-execute` | jwt | 200/min | Coletor bipa tarefa |
| `expedicao-track-status` | none + token | 60/min | Tracking público assinado |

### 8.2 Contrato `api-orders-inbound`
```http
POST /functions/v1/api-orders-inbound
Headers:
  Authorization: Bearer <api-key>
  X-Signature: <hmac-sha256(body, shared_secret)>
  X-Idempotency-Key: <uuid>
Body (Zod .strict()):
{
  "origem": "sfa_mercos",
  "numero_externo": "MER-12345",
  "cnpj_cliente": "00.000.000/0001-00",
  "itens": [
    { "sku": "PROD-001", "quantidade": 12, "preco_unitario": 39.90, "desconto_pct": 0 }
  ],
  "vendedor_externo_id": "V-42",
  "observacoes": "..."
}
Response 202:
{ "pedido_id": "<uuid>", "status": "recebido" }
```

### 8.3 Adapter `FaturamentoProvider`
```ts
export interface FaturamentoProvider {
  emitir(pedido: PedidoFaturavel): Promise<NFEmitida>;
  cancelar(chave: string, motivo: string): Promise<void>;
  consultar(chave: string): Promise<NFStatus>;
}
// implementações: FocusNFeAdapter, NFEioAdapter (intercambiáveis por flag)
```

---

## 9. Frontend: telas, fluxos e padrões

### 9.1 F1 — Recebimento
| Rota | Arquivo | Propósito |
|---|---|---|
| `/distribuidora/recebimento` | `src/pages/distribuidora/RecebimentoListaPage.tsx` | Lista com filtros (status, origem, data) |
| `/distribuidora/recebimento/novo` | `RecebimentoNovoPage.tsx` | Upload XML / criação manual |
| `/distribuidora/recebimento/:id` | `RecebimentoDetalhePage.tsx` | Detalhe + conferência cega + divergências |
| `/distribuidora/recebimento/:id/conferir` | `RecebimentoConferirMobile.tsx` | Mobile-first para operador |

### 9.2 F2 — Estoque
| Rota | Arquivo |
|---|---|
| `/estoque/saldos` | `EstoqueSaldosPage.tsx` (drill por produto/lote/depósito) |
| `/estoque/kardex/:produtoId` | `KardexProdutoPage.tsx` |
| `/estoque/depositos` | `DepositosAdminPage.tsx` |

### 9.3 F3 — WMS
| Rota | Arquivo |
|---|---|
| `/wms/enderecos` | `EnderecosPage.tsx` |
| `/wms/tarefas` | `TarefasOperacionaisPage.tsx` |
| `/wms/coletor` | `ColetorMobilePage.tsx` |

### 9.4 F4 — Comercial
| Rota | Arquivo |
|---|---|
| `/comercial/clientes` | `ClientesPage.tsx` |
| `/comercial/pedidos` | `PedidosKanbanPage.tsx` (kanban com 7 colunas) |
| `/comercial/pedidos/:id` | `PedidoDetalhePage.tsx` |
| `/comercial/credito/politicas` | `CreditoPoliticasPage.tsx` |
| `/comercial/credito/fila` | `CreditoFilaAnalisePage.tsx` |

### 9.5 F5 — Expedição/Faturamento
| Rota | Arquivo |
|---|---|
| `/expedicao/ondas` | `OndasPage.tsx` |
| `/expedicao/romaneios/:id` | `RomaneioPage.tsx` |
| `/faturamento/notas` | `NotasEmitidasPage.tsx` |

### 9.6 Padrões de UI obrigatórios
- Tokens HSL em `src/index.css` (sem `bg-white`/`#fff`).
- `parseLocalDate` em todo `DATE`.
- `formatCurrency` em todo valor.
- `DecimalInput` com 4 casas em custo/quantidade.
- `StoragePreviewDialog` em todo download.
- TanStack Query com `queryKey` por escopo de empresa.
- Skeletons + estados vazios com call-to-action.
- Acessibilidade: foco visível, contraste AA, ARIA em kanban.

---

## 10. Segurança em camadas

> Postura: **zero exposição pública**. Defense-in-depth segue `docs/security/README.md` e `docs/onboarding/07-SECURITY-AND-LGPD.md`.

### 10.1 Edge (perimeter)
- `secureHandler` obrigatório: WAF L7 -> IP blocklist -> JWT/API-key -> quarentena -> MFA -> step-up -> rate-limit -> handler -> security headers.
- HMAC SHA-256 + timing-safe compare em todo webhook inbound.
- Idempotency-key store com TTL 24h.
- SSRF-guard em todo fetch externo.

### 10.2 Database
- RLS habilitada em 100% das novas tabelas.
- Policies usam **semi-join** (sem função SQL pesada em alto volume).
- Roles via `user_roles` + `has_role` SECURITY DEFINER.
- Hierarquia: `supervisor_id` (recursivo); `gerente_id` proibido em código novo.
- Sem FK em `auth.users` (replicar em `profiles`).
- Sem CHECK com função não-imutável (usar trigger).

### 10.3 Storage
- Buckets privados.
- Path obrigatório `<uid>/<empresa_id>/<entidade>/<file>`.
- Validação magic-bytes (`src/lib/utils/file-security.ts`).
- Limite 20 MB; double-extension bloqueada.
- Download via `triggerBlobDownload` (nunca `window.open`).

### 10.4 Step-up MFA
- Operações de alto risco (cancelar NF, ajuste manual de estoque > X, exclusão de pedido): `requireStepUp: '<scope>'` + token TOTP recente.

### 10.5 Auditoria (LGPD + SOX-like)
- `crd_analise`, `oms_pedido_status_hist`, `recebimento_status_hist`, `wms_tarefa_log`, `fat_nota_emitida` mantêm trilha imutável.
- Acesso a PII (CPF/CNPJ cliente) logado em `sensitive_audit`.

### 10.6 Migrations destrutivas
- Token `-- ALLOW-DESTRUCTIVE: <motivo> (BIM-####)` obrigatório.
- CI `guard-destructive-migrations` bloqueia ausência.
- Backup/PITR confirmado antes de merge.
- Política: `docs/incidents/2026-05-16-fabrica-br-data-loss.md`.

### 10.7 Secrets
- Gerenciados via tool de secrets Lovable; **nunca** hardcoded; nunca logados.
- `LOVABLE_API_KEY` auto-provisionada.
- Rotação trimestral documentada.

### 10.8 E2E de segurança
- `scripts/security/e2e-anonymous-sensitive-columns.sh`
- `scripts/security/e2e-authenticated-sensitive-columns.sh`
- `scripts/security/e2e-clickjacking.sh`
- CI `.github/workflows/security-rls-e2e.yml`

---

## 11. Estratégia anti-quebra de produção

1. **Feature flags por empresa** — default OFF; ativar em 1 distribuidora-piloto, observar 1 ciclo, expandir.
2. **Expand -> Migrate -> Contract**: expand cria coexistindo; migrate shadow-write + backfill + drift job; contract após 1 ciclo limpo.
3. **Shadow write Kardex**: nova canônica + antiga em paralelo por 1 ciclo (referência: `EstoqueAuditoriaDriftPage`).
4. **Migrations destrutivas**: bloqueadas no CI sem token explícito.
5. **Rollback plan** por fase: cada PR descreve reversão.
6. **Canary release** via flag por empresa.
7. **Backup pré-migration**: scripts em `scripts/recovery/`.
8. **Health checks** pós-deploy via `supabase--cloud_status` + smoke tests.

---

## 12. Integração Protheus (placeholder)

**Decisão deliberada**: nesta onda, Protheus entra apenas como **observação**.

- Campo `recebimentos.origem_externa` aceita valor `'protheus_manual'` (upload manual de XML cobre o gap).
- `oms_pedido.observacao_integracao_protheus TEXT NULL` reservado.
- Doc `docs/onboarding/18-PROTHEUS-PLACEHOLDER.md` registra:
  > "Integração com Protheus pendente de definição com a equipe técnica da fábrica. Quando ativada, alimentará apenas o passo 1 (Recebimento) via XML/REST automatizado. O restante da espinha dorsal **não muda**."
- Planejamento técnico detalhado (REST/SOAP/SFTP, mapeamento TES/CFOP, custo médio, MRP) será tratado em **planejamento dedicado v6.0** após sessão com a equipe Protheus.

---

## 13. Observabilidade e SRE

- **Logs estruturados** em toda edge (JSON; correlation-id; sem PII).
- **Métricas** via Supabase analytics (latência, error rate, throughput).
- **Alertas**: erro > 1% em 5min; latência p95 > 2s; fila `integration_queue` > N pendentes.
- **Dashboards**: `/admin/observabilidade/distribuidora`.
- **SLOs propostos**:
  - API `/api-orders-inbound`: 99.5% sucesso em 30 dias.
  - Tempo XML -> entrada estoque: p95 < 5min.
  - Análise crédito manual: p95 < 4h (horário comercial).
  - NF emitida: p95 < 10min após separação.
- **Runbooks** em `docs/runbooks/` (a criar): falha provider fiscal, falha SFA inbound, drift de Kardex.

---

## 14. Testes, QA, CI/CD

- **Unit**: Vitest em `src/**/__tests__/` (cobertura mínima 70% no código novo).
- **Integração**: edges testadas com `supabase--test_edge_functions`.
- **E2E**: Playwright em `e2e/distribuidora/` (a criar): receber XML -> conferir -> vender -> faturar -> expedir.
- **Carga**: k6 contra `api-orders-inbound` (100 pedidos/min).
- **CI obrigatório**: `regression-greps.yml`, `security-rls-e2e.yml`, `guard-destructive-migrations.yml`, `typecheck.yml`.
- **Code review**: CODEOWNERS por área; 2 aprovadores em migrations destrutivas.

---

## 15. Mapa de caminhos para auditoria externa

> Para o agente externo (Cloud Code, Claude Code, Cursor) validar este documento contra o repositório real.

### 15.1 Onboarding canônico
- `AGENTS.md` — convenções inegociáveis.
- `AI_CONTEXT.md` — system prompt portátil.
- `docs/onboarding/00-INDEX.md` ... `13-GOTCHAS.md`.
- `mem://index.md` — regras core (no agent Lovable).

### 15.2 Padrões a inspecionar
| O que validar | Caminho |
|---|---|
| Estrutura multi-tenant | `src/contexts/EmpresaContext.tsx`, `user_empresas` |
| RLS pattern semi-join | qualquer `supabase/migrations/*` recente |
| Roles & has_role | `user_roles` + função SECURITY DEFINER |
| Secure-handler | `supabase/functions/_shared/secure-handler.ts` |
| AI Gateway | `supabase/functions/_shared/ai-gateway-call.ts` + `src/lib/ai/invokeChat.ts` |
| Parser NF-e (reuso) | `src/lib/fabrica/nfe-xml-parser.ts`, `supabase/functions/process-nfe-xml/` |
| Idempotency | `supabase/functions/_shared/idempotency.ts` |
| HMAC | `supabase/functions/_shared/timing-safe.ts` |
| SSRF guard | `supabase/functions/_shared/ssrf-guard.ts` |
| Storage download seguro | `src/components/common/StoragePreviewDialog.tsx` + `triggerBlobDownload` |
| Datas DATE | `src/lib/utils/parseLocalDate.ts` |
| Decimal precision | `src/components/ui/DecimalInput.tsx` |
| Hub integração | tabelas `integration_*`; padrão usado por `supabase/functions/asana-sync/`, `shipsgo-*` |
| Sync ERP referência | `src/pages/financeiro/ContasPagarSyncPage.tsx`, `VendasSyncPage.tsx`, `supabase/functions/estoque-n8n-sync/` |
| Drift / auditoria | `src/pages/estoque/EstoqueAuditoriaDriftPage.tsx` |
| Migration destrutiva (política) | `docs/incidents/2026-05-16-fabrica-br-data-loss.md`, `.github/workflows/guard-destructive-migrations.yml` |
| CI segurança | `.github/workflows/security-rls-e2e.yml` |
| CODEOWNERS | `.github/CODEOWNERS` |

### 15.3 Tabelas a auditar (estado atual vs. proposta)
- Duplicidade Kardex: `SELECT count(*) FROM estoque_movimento; SELECT count(*) FROM estoque_movimentacoes;`
- Duplicidade NF fábrica: `fabrica_notas_fiscais` vs `fabrica_notas_fiscais_saida`.
- Mapeamento `empresas` <-> `estoque_distribuidoras` (1:1? N:1?).

### 15.4 Greps úteis para revisão
```bash
rg "new Date\(['\"]20" src/                       # bugs DATE
rg "window\.open\(" src/                          # download inseguro
rg "bg-white|text-black|#[0-9a-fA-F]{3,6}" src/   # cores literais
rg "z\.object\(\{[^}]*\}\)" src/lib/validations/  # confirmar .strict()
rg "gerente_id" src/                              # uso deprecado
rg "callAIGateway|invokeChat" supabase/functions src/
```

---

## 16. Glossário

- **OMS** — Order Management System.
- **WMS** — Warehouse Management System.
- **SFA** — Sales Force Automation (Mercos).
- **SoR** — System of Record.
- **3PL** — Third-Party Logistics.
- **Polo Administrativo** — módulos administrativos já existentes (PLM, custos, MRP, financeiro DRE).
- **OTIF** — On-Time In-Full (KPI de entrega).
- **FEFO** — First Expired First Out.
- **FIFO** — First In First Out.
- **PITR** — Point-In-Time Recovery.
- **RLS** — Row-Level Security (Postgres).

---

## 17. Anexos

### 17.1 Como o agente externo deve abordar este repositório
1. Ler `AGENTS.md` na raiz.
2. Ler `docs/onboarding/00-INDEX.md` e seguir o roteiro.
3. Consultar `mem://index.md` (se rodando dentro do Lovable) ou `AI_CONTEXT.md` (se externo).
4. Validar cada item da §15 deste documento.
5. Para qualquer mudança: respeitar §10 (segurança) e §11 (anti-quebra).
6. Devolver: novo planograma + lista de divergências entre proposta e código atual.

### 17.2 Cronograma agregado
| Fase | Sprints | Risco | Pré-requisito |
|---|---|---|---|
| F0 | 2 | Baixo | Decisões §5 |
| F1 | 3 | Médio | F0 |
| F2 | 3 | Médio | F0 |
| F3 | 3 | Médio | F2 |
| F4 | 4 | Alto | F2 |
| F5 | 4 | Alto | F3, F4 |
| F6 | 2 | Baixo | F5 |
| F7 | 1 | Baixo | F1 |
| **Total** | **22 sprints** (~11 meses 2-week sprints) | | |

### 17.3 Próximos passos imediatos
1. **Aprovar este documento** com Arquitetura/Engenharia.
2. Responder as 11 decisões §5.
3. Abrir issues no GitHub (1 por fase) com checklists.
4. Conectar Cloud Code / Claude Code ao repositório para auditoria automatizada da §15.
5. Iniciar F0 (saneamento) em sprint dedicado.

---

**Fim do documento v1.0.**
Para perguntas, contatar: Engenharia Bimaster (`@bimaster/eng`).
