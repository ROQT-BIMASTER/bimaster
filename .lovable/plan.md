## Painel de Administração — Integração ShipsGo (com IA Diff)

Espelha o padrão do `AsanaIntegracao.tsx`: página dedicada em **Administração**, com wizard de conexão, listagem de containers locais vs ShipsGo e um agente de IA que compara os dois lados (operacional + técnico) e propõe correções em massa.

### Localização
- Nova rota: `/admin/shipsgo-integracao` (registrada em `App.tsx`).
- Link no `AppSidebar.tsx`, dentro da seção **Administração** (mesmo padrão visual do item Asana).
- Acesso restrito a `admin` (mesma policy de telas AP).

### Estrutura da página (4 abas)

```text
┌─ Header: "Integração ShipsGo" + status do token + botão "Testar conexão" ─┐
├─ Tab 1: Visão Geral (KPIs)                                                │
├─ Tab 2: Containers (lista comparada local ↔ ShipsGo)                      │
├─ Tab 3: Análise IA (relatório operacional + técnico)                      │
└─ Tab 4: Logs & Webhooks                                                   │
```

**Tab 1 — Visão Geral**
- Cards: Total tracking ativo, Em trânsito, Atrasados, Sem ETA, Webhooks 24h, Última sincronização global.
- Gráfico de eventos por dia (últimos 30d) a partir de `shipsgo_shipment_events`.
- Botão "Sincronizar todos" (dispara `shipsgo-sync-shipment` em lote com confirmação).

**Tab 2 — Containers (Diff Operacional)**
Tabela com colunas: Container/BL · Embarque (china_embarques) · Status local · Status ShipsGo · ETA local · ETA ShipsGo · Última atualização · Divergência (badge) · Ações.

Tipos de divergência detectados:
- `ORFAO_LOCAL` — embarque local com container preenchido mas sem `shipsgo_shipments`.
- `ORFAO_SHIPSGO` — tracking no ShipsGo sem `china_embarque_id` vinculado.
- `ETA_DIVERGENTE` — diferença > 1 dia entre ETA local e ShipsGo.
- `STATUS_DIVERGENTE` — status local não bate com último evento.
- `STALE` — sem atualização há > 7 dias.
- `WEBHOOK_FALHO` — último webhook com erro em `shipsgo_webhook_log`.

Filtros por tipo de divergência. Seleção múltipla → botão **"Corrigir selecionados"** (auto-fix em massa com modal de confirmação).

**Tab 3 — Análise IA**
- Botão "Gerar análise completa" → chama edge function `shipsgo-ia-diff`.
- A IA recebe dois payloads:
  1. **Operacional**: amostra de até 200 containers com pares local/ShipsGo + divergências detectadas.
  2. **Técnico**: schema da tabela `shipsgo_shipments` vs lista de campos retornados pela API v2 (`/ocean/shipments`), eventos suportados, webhooks configurados.
- Saída em markdown (`ReactMarkdown`) com seções:
  - Diagnóstico operacional (top divergências, padrões, riscos de atraso)
  - Cobertura de schema (campos da API não persistidos, campos persistidos sem uso)
  - Cobertura de eventos (tipos de evento ShipsGo ainda não tratados)
  - Recomendações priorizadas (P0/P1/P2)
  - Plano de auto-fix sugerido (lista de container_numbers a sincronizar/criar/desvincular)
- Botão "Copiar relatório" + "Salvar análise" (persiste em `shipsgo_ia_analises`).
- Botão **"Aplicar plano de auto-fix"** com senha de confirmação (padrão `PasswordConfirmDialog`).

**Tab 4 — Logs & Webhooks**
- Tabela de `shipsgo_webhook_log` (últimas 100 entradas) com status HMAC, payload truncado e botão "Reprocessar".
- Tabela de execuções de sync (sucesso/falha, duração, container).
- Status do webhook secret (configurado/ausente) e URL para registrar no painel ShipsGo.

### Backend

**Nova tabela** `shipsgo_ia_analises` (admin-only via RLS):
- `payload_operacional jsonb`, `payload_tecnico jsonb`
- `relatorio_md text`, `plano_autofix jsonb`
- `model text`, `created_by uuid`, `aplicado_em timestamptz`

**Novas Edge Functions** (todas com `secureHandler` + admin check):
1. `shipsgo-diff-detect` — calcula divergências entre `china_embarques` e `shipsgo_shipments`. Retorna lista tipada para a Tab 2 e payload da IA.
2. `shipsgo-ia-diff` — monta payloads operacional+técnico, chama `callAIGateway` com **`openai/gpt-5.2`** (fallback `gemini-3-flash-preview`), retorna markdown + `plano_autofix` estruturado via tool calling.
3. `shipsgo-autofix-apply` — recebe `analise_id` + senha, executa o plano (sync, criação, desvinculação) com idempotência e rate limit.
4. `shipsgo-webhook-replay` — reprocessa entrada de `shipsgo_webhook_log`.

**Schema técnico para a IA** vem de constante versionada `supabase/functions/_shared/shipsgo-schema.ts` (mapeia campos oficiais da API v2 → colunas locais). Isso permite que o diff técnico não dependa de introspecção em runtime.

### Frontend — novos arquivos

```text
src/pages/admin/ShipsgoIntegracao.tsx              (página principal, 4 tabs)
src/components/admin/shipsgo/ShipsgoKpiCards.tsx
src/components/admin/shipsgo/ShipsgoDiffTable.tsx
src/components/admin/shipsgo/ShipsgoIaAnalysisPanel.tsx
src/components/admin/shipsgo/ShipsgoLogsTable.tsx
src/components/admin/shipsgo/ShipsgoAutofixDialog.tsx
src/hooks/useShipsgoIntegration.ts                 (testConnection, listDiff, runIaAnalysis, applyAutofix, listLogs)
```

### Modelo de IA
- Primário: `openai/gpt-5.2` (sem `reasoning` — bloqueado em modelos OpenAI no Gateway).
- Fallback automático via `callAIGateway`: `openai/gpt-5-mini` → `gpt-5-nano`.
- Saída estruturada via tool calling (`return_diff_analysis`) para garantir `plano_autofix` parseável.
- Timeout 90s, rate limit 10 req/min por usuário.

### Segurança
- Todas as edge functions validam `has_role(uid, 'admin')`.
- `shipsgo-autofix-apply` exige reautenticação por senha (RPC `verify_user_password`).
- Auditoria: cada autofix gera linha em `audit_log` com `analise_id` e contadores.

### Sidebar / Rota
- `App.tsx`: rota `/admin/shipsgo-integracao` com `<RequireRole role="admin">`.
- `AppSidebar.tsx`: item "Integração ShipsGo" abaixo de "Integração Asana" no grupo Administração.

### Entregáveis nesta implementação
1. Migration: `shipsgo_ia_analises` + RLS admin.
2. 4 edge functions novas + constante de schema.
3. 1 página + 5 componentes + 1 hook.
4. Rota e item de sidebar.
5. Sem alteração nas tabelas existentes de tracking.