# Arquitetura — Canal WhatsApp Próprio (Omnichannel profissional para o Suporte)

> **Status:** proposta de arquitetura para decisão (v1 — 04/07/2026). Substitui o rascunho anterior baseado no `crm-blip` (descartado).
> **Contexto:** o "CRM pequeno" ligado à Blip não atendeu e ficou acoplado ao provedor. O número hoje na Blip é **de outra empresa** — intocável. Objetivo: um canal WhatsApp **próprio, profissional, agnóstico de provedor e simples de operar**, plugado no help desk multi‑departamento que já construímos (IA, SLA, kanban, transferência, tabulação).

---

## 1. As três decisões que definem tudo

1. **Provedor: Meta WhatsApp Cloud API DIRETO** (self‑onboard via Embedded Signup), **não** um BSP. Número próprio, na **nossa** WABA, sem markup de 5–20% por mensagem e sem lock‑in. O repo **já tem** caminho Cloud API direto — não dependemos da Blip.
2. **Número próprio novo e dedicado** — um chip/linha que não esteja em nenhum WhatsApp. Nasce limpo, separado de qualquer número de terceiro, e é **portável** entre WABAs no futuro (sem downtime).
3. **Arquitetura Ports & Adapters** — o núcleo (chamado/IA/SLA) nunca sabe "WhatsApp" nem "provedor". Um **Channel Adapter** isola o transporte. Trocar Cloud API ↔ 360dialog ↔ Twilio amanhã = só outro adapter. Foi o acoplamento à Blip que quebrou o modelo anterior.

**Por que Cloud API direto e não BSP** (pesquisa 2026):
| Modelo | Dono do número/WABA | Custo | Lock‑in |
|---|---|---|---|
| **Cloud API direto** ✅ | **Nós** | Rate da Meta, **sem markup** | Nenhum |
| Tech Provider | Nós (WABA no nosso nome) | Meta + taxa fixa, sem comissão/conversa | Baixo |
| BSP clássico (Blip/Twilio/Wati) | O parceiro segura o crédito | **+5–20% por conversa** (real: 2–5×) | Alto |

Contexto de custo 2026: desde **01/07/2025** a Meta cobra **por mensagem** (template entregue); **resposta de serviço dentro da janela de 24h é grátis no mundo todo**. Brasil migra o billing para **BRL em 01/07/2026**. Utility ~US$0,004 (EUA); tiers de volume desde out/2025. → Para atendimento (majoritariamente dentro da janela), o custo é **quase zero**; só templates proativos custam. Fontes no §10.

---

## 2. Isolamento do número de terceiro — a prova (endereça a preocupação central)

**Risco de vazar para o número da outra empresa: comprovadamente inexistente**, desde que sigamos as regras abaixo. As tabelas da Fase 0 (`suporte_canal_contas`/`suporte_contatos`/`suporte_canal_eventos`) **não têm nenhuma FK, trigger ou RPC** que leia `crm_bots` (onde vivem as credenciais do terceiro). O canal novo se constrói 100% sobre elas, sem importar nada do CRM.

**Regras de blindagem (invioláveis):**
1. **Edge function NOVA e separada** (`suporte-whatsapp-webhook`). **Nunca** reusar/importar `crm-blip-ingest` nem chamar `crm_ingest_message`. Só escreve em `suporte_*`.
2. **Segredos próprios e novos** em Supabase Secrets: `SUPORTE_WA_APP_SECRET`, `SUPORTE_WA_TOKEN`, `SUPORTE_WA_VERIFY_TOKEN`. **Nunca** reusar `META_WHATSAPP_APP_SECRET`/`WHATSAPP_API_TOKEN` existentes (podem apontar para outro número) nem ler `crm_bots`.
3. **Rota distinta** — o webhook do **nosso** número aponta só para a edge nova; o do terceiro continua na `crm-blip-ingest`. Endpoints diferentes, um não conhece o outro.
4. **Número travado no cadastro** — `suporte_canal_contas.identificador` guarda **exclusivamente o nosso `phone_number_id`**. O envio deriva o número **sempre** do cadastro (nunca de env compartilhado nem de parâmetro do request), com **allowlist**: recusa enviar se o `phone_number_id` não bater. É impossível o outbound sair pelo número do terceiro.
5. **Zero API da Blip** no canal próprio: outbound é `graph.facebook.com` com o **nosso** token; nunca `msging.net` com a chave do terceiro.
6. **Sem FK para `crm_bots`** "para reaproveitar credencial" — isso reintroduziria o acoplamento. Segredo sempre em env, resolvido por `(provedor, identificador)`.

> Resultado: edge nova + secrets próprios + número travado + zero import do CRM = **nenhum caminho** alcança o número de terceiro. O verificador adversarial confirmará isso antes de qualquer migration.

---

## 3. Arquitetura de referência (Ports & Adapters)

```
Meta Cloud API (nosso número)
        │  webhook (HTTPS)
        ▼
[ suporte-whatsapp-webhook ]  ← edge NOVA, auth:none, skipWaf, verify_jwt=false
   1. GET verify (hub.challenge) · 2. valida HMAC (x-hub-signature-256, nosso app secret)
   3. grava evento CRU em suporte_canal_eventos (dedupe por message.id) · 4. responde 200 JÁ
        │  (assíncrono)
        ▼
[ worker/normalizador ]  → ChannelAdapter.parseInbound(rawBody) → EVENTO CANÔNICO
   { canal_conta_id, wa_id, nome, tipo, conteudo/interação, external_msg_id, media? }
        │
        ▼
[ NÚCLEO (já existe) ]  rpc_suporte_ingest_externo → contato + conversa 'suporte' + ticket
   (canal='whatsapp') → dispara suporte-agente-v2 (mesma IA/SLA/kanban/transferência)
        │  resposta do bot/agente (mensagens, visibilidade=broadcast)
        ▼
[ trigger egress ] → ChannelAdapter.sendMessage(wa_id, conteudo) via graph.facebook.com
```

**Camada de adapter** (nova, em `supabase/functions/_shared/channel/`):
```ts
interface ChannelAdapter {
  verifySignature(req, rawBody, secret): boolean;
  parseInbound(rawBody): NormalizedMessage[];      // payload cru → canônico
  sendText(to, texto): Promise<SendResult>;
  sendInteractive(to, menu): Promise<SendResult>;  // botões/listas/Flow
  setTyping(to, on): Promise<void>;                // "digitando…" + lido
  downloadMedia(mediaId): Promise<Blob>;
}
```
Implementações: `meta-cloud-adapter.ts` (agora), `twilio-adapter.ts`/`blip-adapter.ts` (se um dia). A edge lê `suporte_canal_contas.provedor` e faz dispatch. **O núcleo nunca importa um adapter concreto.**

**Princípios não‑negociáveis** (pesquisa): responder **200 imediato** e enfileirar (a janela de timeout da Meta é apertada; processar inline gera retries/duplicatas); **idempotência por `message.id`** (Meta entrega at‑least‑once); mídia baixada na hora (URL do media expira).

---

## 4. Reuso vs. descarte

**Reusar (nosso lado, já existe):**
- **Tabelas Fase 0** (`suporte_canal_contas`/`suporte_contatos`/`suporte_canal_eventos`) — já desacopladas do CRM. A coluna `provedor` (já existe) vira o eixo da abstração (`meta_cloud`|`twilio`|`blip`); `config jsonb` guarda `{phone_number_id, waba_id, api_version}` (segredo NUNCA no banco).
- **Caminho Meta Cloud API nativo do repo**: `supabase/functions/whatsapp-webhook/index.ts` (verify GET, HMAC Meta fail‑closed, parse `entry[0].changes[0].value.messages[0]`, envio `graph.facebook.com/v{ver}/{phone}/messages`) e `whatsapp-business-api/index.ts` (`/messages` + `/message_templates`) — **molde ideal**, sem Blip.
- **Helpers `_shared`**: `webhook-hmac.ts::verifyMetaSignature`, `secure-handler.ts` (`auth:'none'`, `skipWaf`), `ssrf-guard.ts` (ao baixar mídia), bucket `chat-anexos`.
- **Todo o núcleo do desk**: `suporte-agente-v2`, SLA, kanban, transferência, analytics — a IA e o SLA não mudam; o WhatsApp é só mais um canal de entrada/saída.

**Descartar (o que reprovou):** o módulo `crm_*`/`crm-blip-*` — nada dele entra. O canal próprio não importa uma linha do CRM.

---

## 5. A camada que surpreende (UX premium, priorizada por impacto × simplicidade)

Tudo **nativo da Cloud API** — sem comprar inbox de terceiro. Ordem de entrega sugerida:

1. **Menu sem digitar (botões/listas)** — abrir chamado, escolher departamento, ver status = **toque**, não texto. Meta reporta conversão muito maior que texto puro. *Nativo, simples.*
2. **WhatsApp Flows** — formulário nativo dentro do chat para abrir/triar chamado e coletar dados (CNPJ, pedido, descrição) **sem link externo**. ~72% de conclusão vs ~35% de web; abandono cai de 60–70% p/ 15–30%. É o maior "wow" de 2025/26 e mata formulário/landing. *Um Flow reaproteitável cobre vários casos.*
3. **"Digitando…" + confirmação de leitura** no bot e no agente — faz parecer atendimento humano/premium, aumenta confiança, reduz abandono. *Endpoint nativo, trivial.*
4. **Notificação proativa de status por template** (chamado aberto → em andamento → resolvido) com **opt‑in** — open rate ~98%, mata o "cadê meu chamado?". *Só template aprovado + opt‑in.*
5. **Visão 360 no agente** (no nosso desk) — o `wa_id` casa com o contato/histórico/tickets anteriores, colado no chat; agente não pesquisa nada.
6. **IA co‑autora (Copilot)** — a IA rascunha a resposta (KB + histórico + dados) e o **agente humano só edita** (não só auto‑resposta). Intercom: +31% de conversas/dia.
7. **Deflection + handoff com resumo** — a IA resolve o comum; ao escalar, o humano abre o chat **com transcrição + motivo + contexto**. Lição Klarna: IA no rotineiro, **humano no complexo/emocional** (senão CSAT cai mesmo com resposta correta).
8. **CSAT/NPS no WhatsApp** logo após resolver, 1 pergunta por botão — resposta >40% vs 20–30% do e‑mail. (Reusa o CSAT que já construímos.)

---

## 6. Segurança e conformidade

- **Isolamento do número de terceiro** (§2) — requisito de projeto, verificado.
- **HMAC fail‑closed** no webhook (assinatura Meta) + **idempotência** por `message.id`.
- **Identidade externa**: contato sem login → 1 usuário‑sistema "Contato Externo" como remetente, identidade real em `metadata`/`suporte_contatos` (padrão já desenhado).
- **🔒 Tools de dados NUNCA para contato externo** — as consultas de vendas (Agente de Dados) exigem `requester_id` interno autenticado; cliente no WhatsApp só recebe triagem/KB/transferência. Vendedor por WhatsApp só ganha dados após **verificação forte** (opt‑in + vínculo `profile_id`), fase futura.
- **LGPD/opt‑in**: template proativo exige opt‑in explícito; desde 09/04/2025 a Meta pode recategorizar Utility→Marketing — planejar templates como utilitários e manter registro de consentimento.

---

## 7. Roadmap em fases (cada fase = valor, tudo aditivo + flag)

- **F4.0 — Provisão (você/negócio):** criar a WABA + registrar o **número novo** via Embedded Signup; gerar `SUPORTE_WA_*` (token, app secret, phone_number_id, verify token). *Sem código.*
- **F4.1 — Entrada + adapter Meta Cloud:** `_shared/channel/` + `meta-cloud-adapter`; `suporte-whatsapp-webhook` (verify, HMAC, dedupe, 200, normaliza) → `rpc_suporte_ingest_externo` → dispara `suporte-agente-v2`. Resultado: WhatsApp vira chamado e a IA responde **no desk**.
- **F4.2 — Saída:** trigger de egress → `sendText` (dentro da janela de 24h). Loop cliente↔atendimento fechado.
- **F4.3 — UX premium 1:** menus por botão/lista (departamento, status) + "digitando…"/lido.
- **F4.4 — WhatsApp Flow:** abrir/triar chamado por formulário nativo.
- **F4.5 — Proativo + CSAT + Copilot do agente:** notificação de status por template (opt‑in), CSAT no Zap, rascunho de IA para o agente.
- **F4.6 — Config/UI:** admin cadastra o número (mostra URL do webhook + verify token para colar no Meta), gerencia templates e opt‑in.

---

## 8. Decisões abertas (preciso de você antes da F4.1)

1. **Confirmar provedor = Meta Cloud API direto + número próprio novo?** (recomendado). Alternativa: um Tech Provider que deixa a WABA no nosso nome (mais features prontas, taxa fixa) — só se não quisermos operar templates/onboarding por conta.
2. **Quem provisiona o número/WABA?** (é passo de negócio: Business Manager da Meta + um chip novo). Posso te entregar o **passo a passo do Embedded Signup** e a lista de secrets.
3. **Escopo do requester externo:** cliente final e/ou fornecedor? (define os menus e templates iniciais).

---

## 9. O que este desenho corrige do modelo anterior
- **Sem Blip / sem CRM antigo** → sem o acoplamento e a fragilidade que reprovou.
- **Número próprio** → profissional, portável, e o de terceiro fica intocado.
- **Agnóstico de provedor** → nunca mais refém de um fornecedor.
- **UX de líder de mercado** (Flows, botões, proativo, Copilot) → simples para o cliente e para o agente — a dor de "complicado" resolvida.

## 10. Fontes
- Meta — [Pricing (por‑mensagem desde 01/07/2025)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/) · [Typing indicators](https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators) · [Migração de número via Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/support/migrating-phone-numbers-among-solution-partners-via-embedded-signup/) · [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)
- Provedor/custos: [SetSmart — pricing 2026](https://setsmart.io/blog/whatsapp-business-api-pricing) · [Tech Provider vs BSP](https://whautomate.com/whatsapp-tech-provider-vs-bsp) · [360dialog pricing](https://360dialog.com/pricing) · [rate limits/quality](https://wasenderapi.com/blog/whatsapp-api-rate-limits-explained-how-to-scale-messaging-safely-in-2025)
- Arquitetura: [Hexagonal (Ports & Adapters)](https://jmgarridopaz.github.io/content/hexagonalarchitecture.html) · [AWS — Hexagonal](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) · [EIP — Channel Adapter](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ChannelAdapter.html) · [Hookdeck — WhatsApp webhooks](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices)
- UX/mercado: [WhatsApp Flows (conclusão ~72%)](https://wa.expert/pages/whatsapp-flows-guide) · [Kanal — Flows](https://getkanal.com/blog/whatsapp-flows-guide-ecommerce) · [Vonage — interactive](https://www.vonage.com/resources/articles/whatsapp-interactive-messaging/) · [Intercom Copilot +31%](https://www.intercom.com/blog/intercom-vs-zendesk-two-ai-agents-put-to-the-test/) · [Klarna (e a correção de rota)](https://www.digitalapplied.com/blog/klarna-reverses-ai-layoffs-replacing-700-workers-backfired) · [Gorgias WhatsApp/360](https://www.gorgias.com/product/whatsapp)
