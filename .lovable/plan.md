
# Módulo: Monitoramento de Containers China (ShipsGo Ocean Tracking)

## Análise da API ShipsGo v2

A API ShipsGo (https://api.shipsgo.com/v2) é REST + JSON, autenticada via header `X-Shipsgo-User-Token`. Para o caso de containers vindos da China, usaremos o domínio **OCEAN**:

- `POST /ocean/shipments` — cria rastreamento de um container (informa container number / BL / booking + carrier).
- `GET  /ocean/shipments` — lista shipments com filtros (`status`, `eta`, `pol`, `pod`...) + paginação (`skip`/`take`).
- `GET  /ocean/shipments/{id}` — detalhes completos (status, ETA real, eventos, portos, carrier).
- `GET  /ocean/shipments/{id}/geojson` — rota geográfica do container (mapa).
- `PATCH /ocean/shipments/{id}` — atualizar tags/refs.
- `DELETE /ocean/shipments/{id}` — encerrar rastreio (libera créditos).
- `GET  /ocean/carriers` — lista de armadores suportados (MSC, COSCO, Maersk, etc.) — necessário para criar shipment.
- **Webhooks Ocean**: `Shipment Created / Updated / Deleted` — entrega push em tempo real, com HMAC-SHA256 (`X-Shipsgo-Webhook-Signature`). É o **modo recomendado** (em vez de polling).

**Limites**: 100 req/min por empresa (headers `X-RateLimit-*`). Cada container ativo consome créditos do plano ShipsGo.

**Possibilidades de uso no Bimaster**:
1. Criar shipment automaticamente ao registrar embarque numa OC China (`china_embarques`).
2. Atualizar status/ETA via webhook → refletir em tempo real na OC, no Painel Executivo China e no Inbox.
3. Mapa com rota do container (geojson) na tela do embarque.
4. Alertas de atraso (ETA recalculada vs. ETA original) → notificação para equipe China/Compras.
5. Dashboard de "Torre de Controle Marítima" (containers em trânsito, atrasados, chegando esta semana).
6. Cruzar `data_eta` real com OC para projetar recebimento no CD e disparar conferência.

## Escopo proposto (MVP)

### 1. Configuração
- Solicitar secret `SHIPSGO_API_TOKEN` e `SHIPSGO_WEBHOOK_SECRET` (HMAC).
- Tela admin em `/configuracoes/integracoes/shipsgo` para testar token (`GET /ocean/carriers`) e exibir status.

### 2. Banco de dados (novas tabelas)
- `shipsgo_shipments`
  - `id`, `embarque_id` (FK → `china_embarques`, opcional), `ordem_compra_id` (FK)
  - `shipsgo_id` (id remoto), `container_number`, `bl_number`, `booking_number`
  - `carrier_code`, `carrier_name`
  - `status` (ex.: `BOOKING_CONFIRMED`, `GATE_IN`, `LOADED`, `EN_ROUTE`, `DISCHARGED`, `GATE_OUT`)
  - `pol_name`, `pol_country`, `pod_name`, `pod_country`
  - `eta_original`, `eta_atual`, `ata` (chegada real), `dias_atraso` (gerado)
  - `last_event_at`, `last_event_description`, `geojson` (jsonb)
  - `raw_payload` (jsonb), `created_by`, `created_at`, `updated_at`
- `shipsgo_shipment_events` — histórico de eventos (timestamp, location, description, vessel).
- `shipsgo_webhook_log` — auditoria de webhooks recebidos (idempotência por `event_id`).
- RLS: leitura para membros da OC/embarque (mesmo padrão de `china_embarques`); inserts/updates apenas via Edge Function (service role).

### 3. Edge Functions (todas com `secureHandler`)
- `shipsgo-create-shipment` — POST /ocean/shipments; aceita `embarque_id` + container/BL.
- `shipsgo-sync-shipment` — pull manual `GET /ocean/shipments/{id}` + geojson (botão "Atualizar agora").
- `shipsgo-list-carriers` — proxy cacheado de `GET /ocean/carriers` (1 dia).
- `shipsgo-webhook` — `verify_jwt = false`; valida HMAC-SHA256 com `SHIPSGO_WEBHOOK_SECRET` (constant-time compare); upsert em `shipsgo_shipments` + insert em `shipsgo_shipment_events`; idempotência.
- `shipsgo-delete-shipment` — DELETE remoto + soft-delete local.

### 4. UI

**Nova rota `/china/torre-containers`** (Torre de Controle Marítima):
- KPIs: Em trânsito, Atrasados, Chegando 7 dias, Entregues no mês.
- Tabela com filtros: container, BL, OC, carrier, status, POL/POD, faixa de ETA, atraso > X dias.
- Linha clicável → `ContainerDetailSheet` (lateral): timeline de eventos, mapa Leaflet com geojson, detalhes do BL, link para a OC.
- Bulk: rastrear N containers, exportar Excel.

**Aba "Tracking" no `ChinaOrdemDetalhe` e em `ChinaEmbarqueInfo`**:
- Para cada embarque com `numero_container`, mostrar status atual + ETA + último evento + botão "Atualizar".
- Se ainda não rastreado, CTA "Iniciar rastreamento" (cria shipment via edge function).

**Componentes novos**:
- `src/components/china/ContainerStatusBadge.tsx`
- `src/components/china/ContainerTimeline.tsx`
- `src/components/china/ContainerRouteMap.tsx` (Leaflet + geojson)
- `src/components/china/ContainerTrackingPanel.tsx` (consumido em embarque + torre)
- `src/pages/ChinaTorreContainers.tsx`

**Hooks**:
- `src/hooks/useShipsgoShipments.ts` (lista + filtros, react-query, staleTime 30s)
- `src/hooks/useShipsgoShipment.ts` (detalhe + events)
- `src/hooks/useCriarShipsgoTracking.ts` (mutation)

### 5. Notificações
- Ao receber webhook `Shipment Updated` com novo `status` ou ETA atrasada > 3 dias, criar `notification` para os membros da OC (reusar `NotificationBell`).

### 6. Sidebar / permissões
- Adicionar item "Torre de Containers" sob módulo China.
- Registrar em `module-screens-map.ts` para defesa em profundidade (`ModuleScreenRoute`).

## Detalhes técnicos relevantes

- **Memória do projeto**: usar `parseLocalDate` para colunas DATE; formatar ETA com `America/Sao_Paulo`; Zod `.strict()` nos payloads das edge functions; nunca expor o token ao cliente.
- **Idempotência do webhook**: chave única `(shipsgo_id, event_type, event_timestamp)` em `shipsgo_webhook_log`.
- **Polling de fallback**: cron diário (`pg_cron` chamando `shipsgo-sync-shipment` para shipments com `status` não-final), além do webhook, para containers que não receberam update há > 24h.
- **Rate limit**: backoff exponencial em 429; processar bulk em chunks de 50 com pause.
- **Mapa**: usar Leaflet (já permitido) + tile gratuito OSM; geojson da ShipsGo é LineString + waypoints.

## Fora de escopo (fase 2)
- Tracking AÉREO (`/air/shipments`) — mesma estrutura, ativar quando houver demanda.
- Compartilhamento público de tracking com cliente final (link read-only com token).
- Custo logístico por container (frete real vs. cotado).

## Próximos passos
1. Aprovação deste plano.
2. Solicitar secrets `SHIPSGO_API_TOKEN` + `SHIPSGO_WEBHOOK_SECRET`.
3. Migration das tabelas + RLS.
4. Edge functions + UI (Torre + aba no embarque) + sidebar.
5. Configurar webhook na dashboard ShipsGo apontando para `https://<project>.functions.supabase.co/shipsgo-webhook`.
