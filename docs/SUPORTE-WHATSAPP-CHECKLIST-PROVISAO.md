# Suporte · WhatsApp — Checklist de provisão (F4.0) — para quando decidirmos ativar

> **Não é para fazer agora** (número adiado). É o roteiro turnkey para quando quiser ligar o canal próprio via **Meta WhatsApp Cloud API direto**. Referência: `docs/ARQUITETURA-SUPORTE-WHATSAPP-CANAL-PROPRIO.md`.

## Pré‑requisitos (negócio, na Meta — sem código)
1. **Número novo e dedicado**: um chip/linha que **não esteja em nenhum WhatsApp** (nem WhatsApp Business App, nem pessoal). Se estiver, remover antes. Nunca usar o número que já está na Blip (é de outra empresa).
2. **Meta Business Manager** (Business Portfolio) da Ruby Rose/Huugs. Verificação de negócio (Business Verification) recomendada para subir limites.
3. **App no Meta for Developers** com o produto **WhatsApp** adicionado, e uma **WABA** (WhatsApp Business Account) sob o nosso portfólio.
4. **Embedded Signup** para registrar o número na **nossa** WABA — assim a posse (número, templates, quality rating) é nossa e o número fica portável, sem lock‑in.
5. Cartão de cobrança no **WhatsApp Manager** (Meta cobra direto; sem markup de BSP).

## Segredos a gerar (Supabase Secrets — nomes EXCLUSIVOS do suporte, nunca reusar os do CRM/cobrança)
| Secret | O que é |
|---|---|
| `SUPORTE_WA_PHONE_NUMBER_ID` | phone_number_id do **nosso** número (trava o outbound) |
| `SUPORTE_WA_WABA_ID` | id da nossa WABA |
| `SUPORTE_WA_TOKEN` | token de acesso (System User token, longa duração) |
| `SUPORTE_WA_APP_SECRET` | app secret p/ validar HMAC do webhook (`x-hub-signature-256`) |
| `SUPORTE_WA_VERIFY_TOKEN` | string nossa para o handshake GET do webhook (`hub.verify_token`) |

> ⚠️ **Isolamento**: NÃO reusar `META_WHATSAPP_APP_SECRET` / `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` já existentes (podem apontar para outro número). Segredos **novos e próprios**. A edge de suporte nunca lê `crm_bots`.

## Configuração do webhook (quando a edge F4.1 existir)
- **Callback URL**: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/suporte-whatsapp-webhook?conta=<canal_conta_id>`
- **Verify token**: o valor de `SUPORTE_WA_VERIFY_TOKEN`.
- **Campos (subscriptions)**: `messages` (mensagens de entrada + status).
- Registrar a conta em `suporte_canal_contas` (`canal='whatsapp'`, `provedor='meta_cloud'`, `identificador=<SUPORTE_WA_PHONE_NUMBER_ID>`, `fila_padrao_id=<fila que recebe>`, `config={waba_id, api_version:'v21.0'}`).

## Identidade externa (uma vez)
- Criar 1 usuário‑sistema **"Suporte — Contato Externo"** (Auth + `profiles`, `status='ativo'`) e guardar o uuid no Vault como `external_contact_user_id` (remetente das mensagens de entrada; identidade real do cliente fica em `metadata`/`suporte_contatos`).

## Ordem de construção depois do número pronto
`F4.1` adapter Meta Cloud + `suporte-whatsapp-webhook` (verify, HMAC, dedupe, 200, normaliza) + `rpc_suporte_ingest_externo` → dispara `suporte-agente-v2`. → `F4.2` egress (envio). → `F4.3+` UX premium (botões/listas, Flows, "digitando…", proativo, Copilot).

## Quando estiver pronto para provisionar
Me avise — eu gero o **prompt Lovable da F4.1** (adapter + webhook + RPC) já com o isolamento verificado adversarialmente, e um teste ponta‑a‑ponta usando o número de teste da Meta antes de apontar o número de produção.
