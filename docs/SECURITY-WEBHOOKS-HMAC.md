# Webhook HMAC verification

Endpoints públicos (`auth: "none"`) que recebem callbacks de provedores
externos validam a assinatura HMAC-SHA256 do body antes de qualquer
processamento. Sem assinatura válida → `401 invalid signature`. Sem secret
configurado → `503 webhook secret not configured` (fail-closed).

Helper canônico: `supabase/functions/_shared/webhook-hmac.ts`.

## Estado por função

| Função | Header | Secret env | Provedor |
|---|---|---|---|
| `pluggy-webhook` | `x-signature` | `PLUGGY_WEBHOOK_SECRET` | Pluggy |
| `phyllo-webhook` | `phyllo-signature` | `PHYLLO_WEBHOOK_SECRET` | Phyllo |
| `whatsapp-webhook` (POST) | `x-hub-signature-256` | `META_WHATSAPP_APP_SECRET` (fallback `META_APP_SECRET`) | Meta WhatsApp |
| `cobranca-whatsapp-webhook` (`/status` POST) | `x-hub-signature-256` | `META_WHATSAPP_APP_SECRET` (fallback `META_APP_SECRET`) | Meta WhatsApp |
| `shipsgo-webhook` | `x-shipsgo-webhook-signature` | `SHIPSGO_WEBHOOK_SECRET` | ShipsGo (já protegido) |
| `erp-webhook-inbound` | `x-api-key` (SHA-256) | chave em `erp_config` / `erp_api_keys` | ERP Huggs (já protegido) |
| `shipsgo-webhook-replay` | JWT + role admin | — | uso interno |

## Onde cadastrar o secret no provedor

- **Pluggy**: Dashboard → Webhooks → cadastre a URL `https://aokkyrgaqjarhlywhjju.functions.supabase.co/pluggy-webhook` e copie o *Signing Secret* exibido. Cole no segredo `PLUGGY_WEBHOOK_SECRET`.
- **Phyllo**: Dashboard → Settings → Webhooks → URL `https://aokkyrgaqjarhlywhjju.functions.supabase.co/phyllo-webhook`. Copie o *Webhook Secret*. Cole em `PHYLLO_WEBHOOK_SECRET`.
- **Meta WhatsApp Cloud API**: o secret usado é o **App Secret** da app Meta (Settings → Basic → App Secret). Configure as URLs `https://aokkyrgaqjarhlywhjju.functions.supabase.co/whatsapp-webhook` e `.../cobranca-whatsapp-webhook/status` no painel WhatsApp do app. Cole em `META_WHATSAPP_APP_SECRET` (ou reutilize `META_APP_SECRET` já existente — o código tenta ambos).

## Validação

```bash
# Tem que retornar 401 (sem assinatura) ou 503 (sem secret configurado).
curl -i -X POST https://aokkyrgaqjarhlywhjju.functions.supabase.co/pluggy-webhook \
     -H 'content-type: application/json' \
     -d '{"event":"item/updated","itemId":"x"}'

curl -i -X POST https://aokkyrgaqjarhlywhjju.functions.supabase.co/phyllo-webhook \
     -H 'content-type: application/json' \
     -d '{"event":"x"}'

curl -i -X POST https://aokkyrgaqjarhlywhjju.functions.supabase.co/whatsapp-webhook \
     -H 'content-type: application/json' \
     -d '{"entry":[]}'
```

## Auditoria

Falhas são gravadas em `security_events` com `event_type = 'webhook.signature_invalid'`,
incluindo `source` (`pluggy`, `phyllo`, `whatsapp`, `cobranca-whatsapp`),
`reason` (`missing signature` | `invalid signature`) e IP do chamador.
Painel de Segurança → Activity Feed exibe os eventos.
