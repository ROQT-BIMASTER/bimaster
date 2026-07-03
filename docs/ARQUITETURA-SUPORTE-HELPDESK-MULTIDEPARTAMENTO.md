# Arquitetura — Suporte / Help Desk Multi‑Departamento (Omnichannel)

> **Status:** proposta de arquitetura para aprovação (v1 — 03/07/2026)
> **Autor:** planejamento técnico
> **Escopo:** central de chamados por departamento (Transporte, Fiscal, Logística, Central ADM CSO, Compras, RH, TI/Sistema e outros), com SLA, tabulação, transferência entre departamentos com IA, relatórios e **entrada omnichannel (chat interno + WhatsApp)**.
> **Restrição‑mãe:** tudo **aditivo** e atrás de **feature flag** — não quebra produção. Construção em **branch de projetos**, PRs em **draft** contra `main`, migrations aplicadas via **Lovable** e com **smoke test** pós‑merge.

---

## 1. Sumário executivo

Hoje já existe no sistema um help desk **de TI/Sistema** funcional porém **de desk único e hardcoded**: uma conversa fixa (`SUPORTE_CONV_ID`) com um bot fixo (`BOT_USER_ID`), tabela `suporte_tickets` com SLA plano de 24h, agente IA (`suporte-agente`), KB, CSAT e auditoria. Ele resolve bem "abrir chamado de sistema", mas **não escala** para múltiplos departamentos, múltiplos agentes humanos por chamado, SLA por área, nem para canais externos como WhatsApp.

A proposta é **generalizar esse desk** num **motor de help desk multi‑fila, omnichannel e orientado a SLA**, seguindo o modelo canônico de mercado (Zendesk / Freshdesk / Jira Service Management), reaproveitando ao máximo o que já existe (`suporte_tickets`, chat, IA, KB, CSAT, auditoria) e retrabalhando o que está engessado (conversa única → **conversa por chamado**; desk único → **filas por departamento**; SLA plano → **políticas de SLA**).

**Decisões já tomadas com o solicitante (03/07/2026):**
1. **Generalizar o desk de TI** (não criar módulo paralelo). TI vira uma fila entre várias.
2. **O formato atual do TI será retrabalhado** (conversa única não serve).
3. **Omnichannel com WhatsApp**: demandas entram também por WhatsApp e caem na **mesma** tabulação/SLA/relatórios.
4. **Profissionalizar** com base no estado da arte do mercado.

---

## 2. Diagnóstico do que já existe (base para reaproveitar)

### 2.1 Reaproveitar (mantém e estende)
| Ativo | O que é | Papel na nova arquitetura |
|---|---|---|
| `suporte_tickets` | ticket com `conversa_id`, `owner_id`, `status` (novo→em_triagem→em_atendimento→aguardando_usuario→escalado→resolvido), `prioridade`, `categoria`, `sla_horas`, `prazo_resposta_em`, `escalado_em`, `projeto_tarefa_id` | **Núcleo** do ticket. Estendido com `fila_id`, `canal`, `assignee_id`, `requester_id`, `contato_id`, prazos de SLA. |
| `suporte_tickets_audit` | trilha de eventos (`acao`, `payload`, `modelo_ia`) | Trilha única de auditoria (inclui transferências). |
| `suporte_csat` | pesquisa de satisfação 1–5 | Reaproveitada por fila. |
| `suporte_kb` | base de conhecimento (`modulo`, `titulo`, `conteudo`, `palavras_chave`) | Reaproveitada; ganha escopo por fila/departamento. |
| `suporte_pareceres_ti` | parecer técnico | Vira parecer genérico por fila (opcional). |
| `conversas` / `conversas_participantes` / `mensagens` | chat corporativo v2 | **Camada de conversa** de cada chamado (thread por ticket). |
| `mensagens.visibilidade` / `ticket_owner_id` / `ticket_id` | mensagens privadas de suporte dentro do chat | Mantidas; visibilidade passa a considerar **agentes da fila**. |
| `suporte-agente` (edge function) | IA de triagem/tabulação/escala via AI Gateway | Generalizada: **config de IA por fila** + tool de **transferência**. |
| `MyProtocolsBar` / `ProtocolCountdown` | protocolos do usuário no chat | Reaproveitados no painel do solicitante. |
| `departamentos`, `profiles.departamento`, `user_roles`/`app_role`/`has_role()`, `lib/utils/businessDays.ts`, `lib/featureFlags.ts` | infra existente | Filas ligam a `departamentos`; SLA usa `businessDays`; rollout usa feature flag. |

### 2.2 Retrabalhar
- **Conversa única → conversa por chamado.** O `suporte-agente` hoje concentra todos os usuários numa conversa e filtra por `ticket_owner_id`. Isso impede vários agentes humanos e vários departamentos por chamado. Novo modelo: **1 `conversa` dedicada por ticket**.
- **Bot único → agente por fila.** Cada fila tem sua configuração de IA (prompt, se IA está ativa, tools liberadas).
- **SLA plano (24h no código) → políticas de SLA** por fila × prioridade, com horário comercial.

### 2.3 Fora de escopo (não mexer)
- `internal_tickets` ("Central de Demandas", ligada a `prospects`) — demanda interna comercial, domínio diferente. Pode ser **absorvida** numa fase posterior, mas **não** nesta.
- `crm_tickets` — atendimento a **cliente externo por empresa** (CRM). Domínio separado; permanece.

---

## 3. Princípios de design (estado da arte)

Extraídos do modelo canônico de Zendesk/Freshdesk/JSM e adaptados ao nosso stack:

1. **Ticket é a unidade de verdade; a conversa é um anexo dele.** Todo canal (chat, WhatsApp, criação manual) converge para **um ticket**. Métrica, SLA e relatório vivem no ticket — não no chat.
2. **Separar papéis:** *requester* (quem pede — pode ser interno ou um contato externo de WhatsApp), *assignee* (agente responsável), *fila/grupo* (departamento que atende). Um mesmo chamado pode trocar de fila e de assignee sem perder identidade nem histórico.
3. **Canal é um adaptador, não um silo.** WhatsApp/chat/e‑mail entram por adaptadores que normalizam para o mesmo `ticket` + `mensagens`. Trocar de BSP de WhatsApp não deve tocar o núcleo.
4. **SLA como política declarativa**, não constante no código. Primeira resposta ≠ resolução; conta em horário comercial; pausa quando "aguardando usuário".
5. **IA assiste e roteia, humano decide.** IA classifica, roteia, responde o que é seguro e **escala/transfere com handoff explícito**; sempre há caminho para humano.
6. **Tudo auditável e idempotente.** Cada mudança de estado gera evento; webhooks e triggers de IA precisam ser idempotentes (WhatsApp reentrega por até 7 dias).

---

## 4. Modelo de dados

Notação: `+` nova tabela, `~` coluna nova em tabela existente. DDL abaixo é **esboço** (as migrations definitivas serão geradas para o Lovable aplicar).

### 4.1 Filas (departamentos‑desk) e agentes

```sql
-- + suporte_filas: um "desk" por departamento
CREATE TABLE public.suporte_filas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL,
  slug             text NOT NULL UNIQUE,          -- 'fiscal', 'transporte', 'rh', 'ti'
  departamento_id  uuid REFERENCES public.departamentos(id),  -- liga à estrutura org (opcional)
  descricao        text,
  cor              text,
  icone            text,
  ativo            boolean NOT NULL DEFAULT true,
  aceita_chamados  boolean NOT NULL DEFAULT true,
  ordem            int NOT NULL DEFAULT 0,
  -- IA por fila
  ia_habilitada    boolean NOT NULL DEFAULT false,
  ia_prompt        text,                          -- prompt específico do departamento
  ia_pode_transferir boolean NOT NULL DEFAULT true,
  -- SLA default da fila (fallback quando não há policy específica)
  sla_primeira_resposta_horas int NOT NULL DEFAULT 8,
  sla_resolucao_horas         int NOT NULL DEFAULT 24,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- + suporte_fila_agentes: quem atende cada fila (dirige o RLS)
CREATE TABLE public.suporte_fila_agentes (
  fila_id  uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL,
  papel    text NOT NULL DEFAULT 'agente' CHECK (papel IN ('agente','lider')),
  ativo    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fila_id, user_id)
);
```

> **Por que membership por fila e não o papel global `suporte`?** Um agente do Fiscal não deve ver chamados de RH (dados sensíveis). O papel `suporte`/`admin` global vira apenas "vê tudo" (supervisão); a visibilidade normal é **por fila** via `suporte_fila_agentes`.

### 4.2 Canais e contatos (omnichannel)

```sql
-- + suporte_canal_contas: contas/números conectados (1 por número WhatsApp)
CREATE TABLE public.suporte_canal_contas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal             text NOT NULL CHECK (canal IN ('whatsapp','email','chat_interno')),
  provedor          text,                    -- 'meta_cloud', 'twilio', '360dialog'...
  identificador     text NOT NULL,           -- phone_number_id (WhatsApp) / caixa de e-mail
  display_number    text,                    -- número exibido
  fila_padrao_id    uuid REFERENCES public.suporte_filas(id),  -- onde cai por default
  ativo             boolean NOT NULL DEFAULT true,
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,         -- tokens ref, waba_id etc (segredo fica no Vault/secret)
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal, identificador)
);

-- + suporte_contatos: requester externo (não é usuário do sistema)
CREATE TABLE public.suporte_contatos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal        text NOT NULL,               -- 'whatsapp'
  external_id  text NOT NULL,               -- wa_id do WhatsApp
  telefone     text,
  nome         text,
  profile_id   uuid,                        -- se casarmos com um profiles.id interno
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal, external_id)
);
```

> **wa_id vs telefone:** a Cloud API identifica o cliente por `wa_id` (nem sempre igual ao telefone). Guardamos `external_id = wa_id` como chave de deduplicação e `telefone` como exibição. ([Meta – messages webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages))

### 4.3 Ticket generalizado

```sql
-- ~ estende suporte_tickets
ALTER TABLE public.suporte_tickets
  ADD COLUMN IF NOT EXISTS fila_id       uuid REFERENCES public.suporte_filas(id),
  ADD COLUMN IF NOT EXISTS canal         text NOT NULL DEFAULT 'chat_interno',   -- chat_interno | whatsapp | email | manual
  ADD COLUMN IF NOT EXISTS canal_conta_id uuid REFERENCES public.suporte_canal_contas(id),
  ADD COLUMN IF NOT EXISTS requester_id  uuid,           -- usuário interno solicitante (= antigo owner_id)
  ADD COLUMN IF NOT EXISTS contato_id    uuid REFERENCES public.suporte_contatos(id),  -- solicitante externo
  ADD COLUMN IF NOT EXISTS assignee_id   uuid,           -- agente responsável
  ADD COLUMN IF NOT EXISTS protocolo     text UNIQUE,    -- RR-YYYYMMDD-XXXXXX persistido
  ADD COLUMN IF NOT EXISTS prazo_primeira_resposta_em timestamptz,
  ADD COLUMN IF NOT EXISTS primeira_resposta_em       timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_resolucao_em         timestamptz,
  ADD COLUMN IF NOT EXISTS sla_status    text DEFAULT 'dentro' CHECK (sla_status IN ('dentro','em_risco','violado','pausado','cumprido')),
  ADD COLUMN IF NOT EXISTS reaberto_em   timestamptz,
  ADD COLUMN IF NOT EXISTS tags          text[] NOT NULL DEFAULT '{}';

-- owner_id continua existindo; requester_id é preenchido a partir dele (compat).
-- status ganha 'aguardando_terceiros' (opcional) para pausar SLA sem culpar o usuário.
```

Relacionamentos resultantes:

```
departamentos ──1:N── suporte_filas ──1:N── suporte_fila_agentes
                           │
                           ├─1:N─ suporte_sla_policies
                           └─1:N─ suporte_tickets ──1:1── conversas (thread do chamado)
                                        │
                                        ├─ requester_id → profiles           (interno)
                                        ├─ contato_id   → suporte_contatos    (externo/WhatsApp)
                                        ├─ assignee_id  → profiles            (agente)
                                        ├─1:N─ suporte_transferencias
                                        ├─1:N─ suporte_tickets_audit
                                        └─1:N─ suporte_csat
```

### 4.4 Políticas de SLA

```sql
-- + suporte_sla_policies: por fila × prioridade
CREATE TABLE public.suporte_sla_policies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_id                  uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  prioridade               text NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  primeira_resposta_horas  int NOT NULL,
  resolucao_horas          int NOT NULL,
  usa_horario_comercial    boolean NOT NULL DEFAULT true,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fila_id, prioridade)
);
```

### 4.5 Transferências entre departamentos

```sql
-- + suporte_transferencias: trilha de handoff entre filas/agentes
CREATE TABLE public.suporte_transferencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  de_fila_id      uuid REFERENCES public.suporte_filas(id),
  para_fila_id    uuid NOT NULL REFERENCES public.suporte_filas(id),
  de_assignee_id  uuid,
  para_assignee_id uuid,
  motivo          text,
  via_ia          boolean NOT NULL DEFAULT false,
  transferido_por uuid,               -- NULL quando IA
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. Omnichannel — adaptador WhatsApp

### 5.1 Onde o WhatsApp encaixa

O WhatsApp **não é uma tabela nova de chat** — é um **canal** que injeta mensagens no mesmo `ticket`/`mensagens`. Fluxo:

```
Meta Cloud API ──webhook──▶ edge function `whatsapp-webhook`
                                   │  (verifica assinatura, idempotência por message.id)
                                   ▼
             upsert suporte_contatos (por wa_id)  ──▶ acha/abre suporte_ticket (fila padrão da conta)
                                   ▼
             insere em `mensagens` (conversa do ticket, tipo texto/imagem, canal=whatsapp)
                                   ▼
             dispara triagem IA (mesma pipeline do chat) / notifica agentes da fila
```

Resposta do agente (ou IA) no chat interno do ticket → edge function `whatsapp-send` → Cloud API → cliente.

### 5.2 Regras específicas do WhatsApp que a arquitetura precisa respeitar

- **Janela de atendimento de 24h (CSW):** só é possível enviar **mensagem livre** enquanto a janela está aberta; ela **abre e reinicia** a cada mensagem do cliente. Fora da janela, só **template aprovado (HSM)**. → guardamos `janela_expira_em` no contato/ticket e a UI **bloqueia texto livre** fora da janela, oferecendo templates. ([SaySimple – Customer Care Window](https://www.saysimple.com/blog/whatsapp-business-api-what-is-a-customer-care-window))
- **Pricing por mensagem (desde 01/07/2025):** cobra‑se por **template entregue**; mensagens livres dentro da janela são grátis; templates têm categoria **utility / authentication / marketing** com preço por país. Para suporte, o uso é majoritariamente **utility** (barato) e texto livre na janela (grátis). → registrar `categoria_template` para custo/relatório. ([Meta – Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [YCloud – atualização 01/07/2025](https://www.ycloud.com/blog/whatsapp-api-pricing-update))
- **Idempotência e reentrega:** a Meta entrega o webhook **at‑least‑once** e reentrega por até **7 dias** se não receber HTTP 200. → deduplicar pelo `messages[].id` (formato `wamid...`) com **unique index**; o TTL/janela de dedupe precisa ser **≥ a janela de retry** (7 dias), senão um retry tardio cria ticket duplicado.
- **Mídia expira rápido:** a mensagem traz só um `media id` (não URL). Para baixar: `GET /{media_id}` → devolve URL do `lookaside.fbsbx.com`; depois `GET {url}` com Bearer token. **A URL expira em 5 minutos e o `media id` em 7 dias.** → baixar **na hora do recebimento** e subir para o bucket `chat-anexos` (mesmo padrão do chat), gravando em `mensagens_anexos`. ([Meta – Media download](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/media/media-download-api))
- **Threading = janela de 24h (session‑based):** produtos maduros abrem **1 ticket por sessão de conversa** — se chega mensagem e existe ticket aberto do mesmo `wa_id` com último inbound < 24h, **anexa**; senão **abre novo ticket**. Isso alinha o threading com a janela de cobrança do WhatsApp (Freshdesk usa exatamente 24h, extensível a 48h). ([Freshdesk – WhatsApp threading](https://support.freshdesk.com/support/solutions/articles/238137-whatsapp-for-freshdesk-business-integration))
- **Identificadores:** `phone_number_id` (nossa conta) e `wa_id` (cliente) vêm no payload; casam com `suporte_canal_contas.identificador` e `suporte_contatos.external_id`. ([Meta – webhooks reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages))

### 5.3 Padrão de ingestão — idempotente e assíncrono (anti‑padrão nº1)

Processar o webhook **de forma síncrona** é o erro clássico: se o handler termina o trabalho mas o HTTP 200 chega depois do timeout da Meta, ela **reentrega** e a lógica roda 2×. Padrão correto:

```
verifica assinatura da Meta ─▶ grava evento CRU em suporte_canal_eventos ─▶ responde 200/202 já
                                                    │
                                        (async) worker/trigger processa com dedupe por wamid
```

```sql
-- + suporte_canal_eventos: fila de eventos crus de entrada (idempotência + reprocesso)
CREATE TABLE public.suporte_canal_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal         text NOT NULL,
  external_msg_id text NOT NULL,        -- wamid... (dedupe)
  payload       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processado','erro')),
  erro          text,
  recebido_em   timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  UNIQUE (canal, external_msg_id)       -- reentrega da Meta vira no-op
);
```

O `whatsapp-webhook` só valida + insere aqui (rápido, sempre 200). Um worker (trigger `AFTER INSERT`, ou a própria function em segundo passo) faz upsert de contato, resolução de ticket por janela de 24h, download de mídia e insere em `mensagens`. Reprocessável e auditável.

### 5.4 Fornecedor: **Blip** (decisão resolvida — números já integrados lá)

Os números de WhatsApp da empresa **já estão na Blip** (Take Blip, BSP oficial). Então o adaptador conversa com a **Blip**, não com a Meta diretamente:

- **Entrada:** a Blip tem **Webhook** nativo — todo tráfego de mensagens/eventos/contatos do bot é enviado por **HTTPS POST (JSON, protocolo LIME)** para a URL que configurarmos, com headers customizáveis para autenticação. → nossa edge function `blip-webhook` recebe, valida o header secreto e grava em `suporte_canal_eventos` (mesmo padrão idempotente da §5.3, deduplicando pelo `id` da mensagem LIME). ([Blip – Webhook](https://help.blip.ai/hc/en-us/articles/19999827207063-Webhook-Collection), [formato de envio](https://help.blip.ai/hc/en-us/articles/29187147295767-Webhook-Submission-Format))
- **Saída:** envio via **API da Blip** (`https://{contrato}.http.msging.net/messages`) com **Authorization Key** do bot — inclusive **notificações com template** fora da janela de 24h. ([Blip – enviar notificação WhatsApp via API](https://hmg-help.blip.ai/docs/channels/whatsapp/enviar-notificacao-whatsapp-blip-api/), [docs.blip.ai](https://docs.blip.ai/))
- **Templates (HSM):** criados/geridos **no portal da Blip**, que os registra na WABA. Nosso lado só referencia o nome/variáveis do template.
- **As regras da plataforma continuam valendo** (são da Meta, não do BSP): janela de 24h para texto livre, template fora da janela, categorias utility/marketing — tudo da §5.2 permanece.
- **Mapeamento no schema:** `suporte_canal_contas.provedor='blip'`, `identificador` = identidade do bot/roteador Blip do número, `config` = `{contrato, bot_id}` (a **Authorization Key fica em Secret** do Supabase, nunca na tabela).
- **Modos único + por área:** cada número na Blip vira uma linha em `suporte_canal_contas` com sua `fila_padrao_id` — o número único aponta para uma fila de triagem onde a IA roteia; números por área apontam direto para a fila do departamento.

**Ponto de atenção (decidir na Fase 4):** se os números têm **fluxos de bot ativos na Blip** (router/builder), precisamos escolher onde o nosso desk se pluga: (a) o fluxo Blip transfere para um "sub‑bot"/estado que só repassa ao nosso webhook, ou (b) o webhook global recebe tudo em paralelo e o desk ignora o que o bot já resolve. A opção (a) é a mais limpa quando já existe bot de autoatendimento.

A abstração `provedor` continua valendo: se um dia sair da Blip, troca‑se o adaptador sem tocar em tickets/SLA/relatórios.

---

## 6. Motor de SLA

Vocabulário de métrica alinhado ao padrão de indústria (Zendesk/Freshdesk/JSM): **first response** (1ª resposta pública de agente/IA), **next reply** (cada resposta subsequente a uma nova mensagem do usuário) e **resolution** (resolução total). Modelamos as três; `next reply` é opcional na v1 mas o schema já comporta.

1. **Relógio‑duplo (calendário + comercial):** guardamos a duração em **horas de calendário E em horas comerciais**. O SLA é medido no relógio comercial (`lib/utils/businessDays.ts` ou função SQL com o calendário da empresa), mas mostramos ambos — o cliente esperou a noite/fim de semana inteiros mesmo que "não conte" para o SLA. Exemplo clássico: sexta 16h → segunda 10h = **66h de calendário, mas só 2h comerciais** (9–17h). Não medir os dois é o erro que "maquia" a operação.
2. **Cálculo na abertura e a cada troca de fila/prioridade:** resolve a policy (`suporte_sla_policies` por `fila_id`+`prioridade`; fallback para os defaults da fila) e grava `prazo_primeira_resposta_em` e `prazo_resolucao_em`. Seleção da policy é **first‑match por ordem** (como todos os produtos maduros fazem).
3. **Primeira resposta:** ao primeiro reply **público** de agente/IA (nota interna não conta), grava `primeira_resposta_em`; se ≤ prazo → cumprido.
4. **Pausa "aguardando usuário" — a funcionalidade mais ausente em ferramentas caseiras:** status `aguardando_usuario`/`aguardando_terceiros` **pausa** o relógio de resolução (não penaliza a área) e retoma quando o usuário responde. `sla_status='pausado'`. Sem isso, os números de resolução ficam inflados e injustos.
5. **Estados:** `dentro` → `em_risco` (ex.: <20% do prazo restante) → `violado`; e `cumprido`/`pausado`. Um monitor recalcula.
6. **Monitor + escalonamento:** edge function `suporte-sla-monitor` agendada (pg_cron ou trigger agendado) marca `em_risco`/`violado`, **notifica** assignee + líder da fila e pode **escalar** automaticamente. Escalonamento com níveis/destinatários por tipo de violação (1ª resposta vs resolução) é padrão first‑class no Freshdesk — bom modelo a espelhar. Reaproveita a tabela `notifications`.

### 6.1 Calendário comercial + defaults de SLA (semeados, editáveis)

```sql
-- + suporte_calendarios: horário comercial (default único, SP)
CREATE TABLE public.suporte_calendarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'America/Sao_Paulo',
  -- intervalos por dia da semana (0=dom..6=sáb); horário local
  intervalos  jsonb NOT NULL DEFAULT '[
    {"dow":1,"inicio":"08:30","fim":"17:30"},
    {"dow":2,"inicio":"08:30","fim":"17:30"},
    {"dow":3,"inicio":"08:30","fim":"17:30"},
    {"dow":4,"inicio":"08:30","fim":"17:30"},
    {"dow":5,"inicio":"08:30","fim":"17:30"}
  ]'::jsonb,
  feriados    date[] NOT NULL DEFAULT '{}',   -- feriados nacionais/locais
  is_default  boolean NOT NULL DEFAULT false,
  ativo       boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- suporte_filas ganha calendario_id (nullable → usa o default)
ALTER TABLE public.suporte_filas
  ADD COLUMN IF NOT EXISTS calendario_id uuid REFERENCES public.suporte_calendarios(id);
```

**Defaults de mercado a semear em `suporte_sla_policies`** (horas comerciais; alteráveis na tela de config). Valores alinhados a práticas de service desk — ponto de partida, não regra fixa:

| Prioridade | 1ª resposta | Resolução |
|---|---|---|
| `critica` | 1 h | 4 h |
| `alta` | 2 h | 8 h (1 dia útil) |
| `media` | 4 h | 24 h (3 dias úteis) |
| `baixa` | 8 h | 40 h (5 dias úteis) |

Semeado para **todas as filas**; cada fila pode sobrescrever depois. O admin edita tudo em `/dashboard/suporte/config`.

---

## 7. Roteamento, IA e transferência

### 7.1 Roteamento de entrada
- **Chat interno:** o solicitante escolhe o departamento (fila) num seletor → ticket nasce na fila certa.
- **WhatsApp:** cai na `fila_padrao_id` da conta; a **IA de triagem** pode reclassificar e transferir.
- **Atribuição dentro da fila (estratégias padrão de mercado, evoluir por etapas):**
  1. **Pool (v1):** fila = caixa comum; agentes puxam o próximo. Simples e robusto.
  2. **Round‑robin:** distribui sequencialmente entre agentes ativos da fila.
  3. **Load‑balanced / maior capacidade livre:** cada agente tem um teto de tickets simultâneos; entra no que tem mais folga (modelo Zendesk "highest spare capacity" / Freshdesk load‑based).
  4. **Skill‑based (futuro):** por habilidade/competência (ex.: "ICMS‑ST" no Fiscal), com fila de fallback.
  Só entram agentes com **status elegível** (online/disponível). O `suporte_fila_agentes` já carrega a associação; capacidade/skill entram como colunas quando necessário.

### 7.2 IA (generalização do `suporte-agente`)
Mesma pipeline atual (AI Gateway + tools + KB + protocolo + auditoria), porém:
- **Prompt e ativação por fila** (`suporte_filas.ia_prompt`, `ia_habilitada`).
- **Conversa por ticket** (não mais a conversa única): o agente carrega o histórico da `conversa` do ticket.
- **Tools existentes mantidas** (`definir_titulo_categoria`, `buscar_conhecimento_base`, `criar_tarefa_suporte`, `escalar_para_admin`, `marcar_ticket_resolvido`) **+ nova tool `transferir_departamento`**.
- **Papéis de IA (estado da arte):** (a) *triagem/tabulação*, (b) *auto‑resolução/deflection* via KB, (c) *agent‑assist* (sugerir resposta ao humano), (d) *roteamento/transferência*, (e) *resumo* do ticket no handoff.

### 7.3 Transferência entre departamentos (com notificação ao usuário de origem)
RPC canônica (`SECURITY DEFINER`, padrão do projeto):

```
rpc_suporte_transferir(p_ticket_id, p_para_fila_id, p_motivo, p_via_ia default false)
  1. valida permissão (agente da fila atual, líder ou admin; IA via service_role)
  2. INSERT suporte_transferencias (de_fila, para_fila, motivo, via_ia, transferido_por)
  3. UPDATE suporte_tickets SET fila_id = para_fila, assignee_id = NULL, sla recalculado
  4. ajusta participantes da conversa (adiciona agentes da nova fila; mantém histórico)
  5. INSERT mensagens tipo 'sistema' na thread ("Transferido de X para Y — motivo…")
  6. INSERT suporte_tickets_audit (acao='transferencia')
  7. INSERT notifications para o requester_id  → "Seu chamado {protocolo} foi encaminhado
     para {Departamento} e está {status}."  (e, se canal=whatsapp e janela aberta,
     dispara whatsapp-send informando o cliente)
```

A IA aciona exatamente essa RPC via a tool `transferir_departamento`, garantindo **mesma trilha** e **mesma notificação** que uma transferência humana. É isso que satisfaz o requisito "transferir chamados entre departamentos com IA informando o status ao usuário de origem".

---

## 8. Modelo de conversa: conversa por chamado + migração do TI legado

- **Novo padrão:** cada `suporte_ticket` tem **sua** `conversa` (`tipo='suporte'`), com participantes = requester (se interno) + agentes da fila + bot da IA. A UI do chamado é o `ChatThread`/`MessageBubble` já existentes.
- **Legado (TI):** os tickets atuais na conversa única continuam **legíveis**. Migração:
  1. cria fila **"TI / Sistema"** e associa `suporte-agente` a ela;
  2. novos chamados de TI já nascem com conversa própria;
  3. (opcional) job que "explode" tickets antigos em conversas próprias — só se necessário para relatório histórico.
- **Feature flag** `suporte_v2` controla se a UI nova aparece; enquanto off, o TI antigo segue intocado em produção.

---

## 9. Segurança / RLS

- **Ticket SELECT:** `requester_id = auth.uid()` **OU** agente ativo da `fila_id` (via `suporte_fila_agentes`) **OU** `has_role(admin/suporte)`.
- **Ticket UPDATE:** agente da fila, líder ou admin.
- **Mensagens do ticket:** ajustar a policy existente de `mensagens` para que `visibilidade='privada_suporte'` seja visível a **requester + agentes da fila do ticket** (hoje é `has_role('suporte')` global) — via função `SECURITY DEFINER` `is_agente_do_ticket(uid, ticket_id)`.
- **Escrita crítica só por RPC** `SECURITY DEFINER` (criar, transferir, decidir SLA) — padrão já usado em `chat_aprovacoes`/`suporte`.
- **WhatsApp webhook:** edge function valida assinatura da Meta e usa `service_role`; contatos externos **não** são usuários autenticados (nunca ganham acesso ao banco — só existem como `suporte_contatos`).
- **Segredos** (tokens WhatsApp) no Vault/secret do Supabase, nunca em `config` legível.

---

## 10. Relatórios / KPIs (tabulação)

KPIs padrão de indústria, todos deriváveis do ticket:

| KPI | Fonte |
|---|---|
| Volume por fila/canal/categoria/período | `suporte_tickets` |
| **First Response Time** (médio, p90) | `primeira_resposta_em - created_at` |
| **Resolution Time** (médio, p90) | `resolved_at - created_at` (descontando pausas) |
| **% SLA cumprido** (1ª resposta e resolução) | `sla_status` / prazos |
| **CSAT** médio por fila/agente | `suporte_csat` |
| Backlog aberto, aging, tickets em risco/violados | `status`, `sla_status` |
| Reopen rate | `reaberto_em` |
| Transferências por fila (origem→destino) | `suporte_transferencias` |
| Volume/custo WhatsApp (templates enviados) | `mensagens` canal=whatsapp + `categoria_template` |

Entrega via **views** (`suporte_metrics_por_fila`, `suporte_metrics_diario`) + dashboard em `recharts` (já usado no `SuporteAdmin`/`CrmTickets`). Filtros: fila/departamento, canal, categoria, prioridade, agente, período.

---

## 11. Frontend

Reaproveitando componentes existentes ao máximo:

| Área | Componente | Origem |
|---|---|---|
| Thread do chamado | `ChatThread`, `MessageBubble`, `MessageInput`, `AnexoView` | chat v2 (reuso direto) |
| Painel do agente (fila) | novo `SuporteDesk` (kanban por status + SLA badge + transferir) | evolui de `SuporteAdmin` |
| Seletor de departamento (abrir chamado) | novo `NovoChamadoDialog` | padrão de dialogs do chat |
| Meus chamados (solicitante) | `MyProtocolsBar` / `ProtocolCountdown` + lista | reuso |
| Config admin (filas, agentes, SLA, KB, IA, WhatsApp) | novo `SuporteConfig` | padrão de `Configuracoes` |
| Relatórios | novo `SuporteRelatorios` (recharts) | padrão `CrmTickets`/`SuporteAdmin` |

Rotas (sob feature flag): `/dashboard/suporte` (solicitante), `/dashboard/suporte/desk` (agente), `/dashboard/suporte/config` e `/dashboard/suporte/relatorios` (admin/líder).

---

## 11-A. Anti‑padrões que este desenho evita (checklist de revisão)

Erros que distinguem um help desk profissional de um caseiro — cada um já endereçado acima:

| Anti‑padrão comum | Como evitamos |
|---|---|
| Status como coluna mutável sem histórico | Trilha **append‑only** em `suporte_tickets_audit` + `suporte_transferencias` (quem/quando/o quê); estado atual no ticket, história nos eventos. |
| SLA em horas de relógio (wall‑clock) | SLA em **horário comercial** com calendário/feriados + **relógio‑duplo** (calendário e comercial). |
| Relógio de SLA não pausa em "aguardando usuário" | Pausa explícita por status (`sla_status='pausado'`). |
| Webhook processado síncrono → tickets duplicados | **Fila de eventos crus** (`suporte_canal_eventos`) + **ack 200 imediato** + dedupe por `wamid` com unique index; TTL ≥ 7 dias (janela de retry da Meta). |
| Conversa como um blob de texto | Mensagens **discretas** em `mensagens` com autor/hora/**visibilidade** (público vs `privada_suporte`). |
| Nota interna vazando para o solicitante | RLS de `mensagens` por visibilidade + agente da fila (nunca expõe `privada_suporte` ao requester). |
| Identidade do solicitante presa a 1 e‑mail/telefone | `suporte_contatos` com `external_id` (wa_id) + `profile_id` opcional → mesma pessoa em vários canais. |
| Tags/categoria como texto livre | **Vocabulário controlado**: `categoria` enumerada + `tags[]` de lista curada; categoria estrutura, tag rotula. |
| Perder contexto na transferência | Mesmo ticket + mesma thread; troca só de `fila_id`/`assignee_id`; evento + notificação. |
| Mídia do WhatsApp perdida | Download **na hora** (URL 5 min / ID 7 dias) para o bucket próprio. |

## 12. Roadmap em fases (aditivo, sem quebrar produção)

> Cada fase: branch própria → migration entregue como **prompt Lovable** → PR **draft** contra `main` → smoke test SQL pós‑merge. Nada substitui o TI atual até a Fase 5.

- **Fase 0 — Fundação (schema, sem UI, sem efeito):** `suporte_filas`, `suporte_fila_agentes`, `suporte_sla_policies`, `suporte_transferencias`, `suporte_contatos`, `suporte_canal_contas`; estende `suporte_tickets`; seed das filas (TI, Transporte, Fiscal, Logística, Central ADM CSO, Compras, RH); backfill dos tickets atuais para a fila TI. **Zero mudança de comportamento.**
- **Fase 1 — Conversa por chamado + desk por fila (chat interno):** `NovoChamadoDialog`, `SuporteDesk`, RLS por fila, status flow. Feature flag `suporte_v2` on para piloto.
- **Fase 2 — Motor de SLA + notificações:** policies, cálculo em horário comercial, `suporte-sla-monitor`, notificações de risco/violação ao solicitante e agentes.
- **Fase 3 — Transferência entre departamentos + IA generalizada:** `rpc_suporte_transferir`, tool `transferir_departamento`, IA por fila, handoff com notificação ao usuário de origem.
- **Fase 4 — Canal WhatsApp:** `whatsapp-webhook` + `whatsapp-send`, contatos externos, janela 24h + templates, mídia no bucket. Entra na **mesma** tabulação/SLA.
- **Fase 5 — Relatórios + corte do legado:** views + dashboard; migração final do TI para o novo desk; aposentar a conversa única; (opcional) absorver `internal_tickets`.

---

## 13. Decisões (resolvidas em 03/07/2026)

1. **Líderes e agentes:** **configuráveis no ambiente pelo admin** (não hardcoded). O seed cria as filas; líder/agentes são atribuídos na tela de config via `suporte_fila_agentes` (`papel='lider'|'agente'`). Filas iniciais semeadas: Transporte, Fiscal, Logística, Central ADM CSO, Compras, RH, TI/Sistema (editáveis).
2. **SLA:** **defaults de mercado semeados + editáveis** no ambiente (por fila × prioridade). Ver §6.1.
3. **WhatsApp:** os números **já estão integrados na Blip** (BSP) → o adaptador usa webhook + API da Blip (ver §5.4). Suportar **os dois modos ao mesmo tempo** — um **número único** (a IA de triagem roteia para a fila certa) **e** **números por área** (cada `suporte_canal_contas` com sua `fila_padrao_id`, `provedor='blip'`). O modelo já comporta N contas. Pendência da Fase 4: como plugar nos fluxos de bot existentes na Blip (§5.4, ponto de atenção).
4. **Escopo externo por WhatsApp:** **sim** — solicitantes externos entram como `suporte_contatos` (não viram usuários do banco). Sem portal web externo por ora.
5. **Horário comercial:** **Brasil/São Paulo, seg–sex 08:30–17:30, configurável** (calendário único default; o schema permite calendário por fila no futuro). Ver `suporte_calendarios` em §6.1.

---

## 14. Fontes (estado da arte)

**WhatsApp Business Platform (Meta Cloud API):**
- [Messages webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages) · [Webhooks components](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/)
- [Pricing (per‑message desde 01/07/2025)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Conversation‑based pricing (deprecada)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing/)
- [Message templates overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) · [Media download (URL 5 min / ID 7 dias)](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/media/media-download-api) · [On‑Premises sunset (EOL 23/10/2025)](https://developers.facebook.com/docs/whatsapp/on-premises/sunset)
- BSPs e threading: [Twilio – WhatsApp key concepts](https://www.twilio.com/docs/whatsapp/key-concepts) · [360dialog vs Twilio](https://www.kommunicate.io/blog/twilio-vs-360dialog-a-comparison/) · [Freshdesk – WhatsApp 24h/48h threading](https://support.freshdesk.com/support/solutions/articles/238137-whatsapp-for-freshdesk-business-integration)

**Modelo de dados canônico (ticket, papéis, canal, tags, comentários, CSAT, macros):**
- Zendesk: [Ticket object](https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/) · [Groups](https://developer.zendesk.com/api-reference/ticketing/groups/groups/) · [Ticket comments (public vs internal)](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_comments/) · [Satisfaction ratings](https://developer.zendesk.com/api-reference/ticketing/ticket-management/satisfaction_ratings/) · [Macros](https://developer.zendesk.com/api-reference/ticketing/business-rules/macros/)
- Freshdesk: [Tickets](https://developers.freshdesk.com/api/#tickets) · [Conversations](https://developers.freshdesk.com/api/#conversations) · Intercom: [Conversation model](https://developers.intercom.com/docs/references/2.1/rest-api/conversations/conversation-model)

**SLA (métricas, horário comercial, pausa, escalonamento):**
- Zendesk: [SLA policies API](https://developer.zendesk.com/api-reference/ticketing/business-rules/sla_policies/) · [About SLA policies](https://support.zendesk.com/hc/en-us/articles/5600997516058-About-SLA-policies-and-how-they-work) · [FRT e horário comercial](https://support.zendesk.com/hc/en-us/articles/4408886961050-Does-the-first-reply-time-reply-take-into-account-business-hours)
- Freshdesk: [Understanding SLA policies (escalonamento inline)](https://support.freshdesk.com/support/solutions/articles/37626-understanding-sla-policies) · JSM: [Set up SLA conditions (start/pause/stop)](https://support.atlassian.com/jira-service-management-cloud/docs/set-up-sla-conditions/)

**Roteamento, atribuição e IA (triagem, agent‑assist, deflection, handoff):**
- Zendesk: [Omnichannel routing](https://support.zendesk.com/hc/en-us/articles/4409149119514-About-omnichannel-routing) · [Intelligent triage](https://support.zendesk.com/hc/en-us/articles/4550640560538-Automatically-classifying-customer-intent-sentiment-and-language) · [Agent copilot](https://support.zendesk.com/hc/en-us/articles/7908817636378-About-agent-copilot) · [Ticket audits](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_audits/)
- Freshdesk: [Omniroute / skill‑based](https://support.freshdesk.com/support/solutions/articles/238979-ticket-assignments-with-freshdesk-omniroute-) · Intercom: [Fin escalation rules & guidance](https://www.intercom.com/help/en/articles/12396892-manage-fin-ai-agent-s-escalation-guidance-and-rules)

**Anti‑padrões (event log, idempotência de webhook, identidade, taxonomia):**
- [Webhook idempotency & deduplication](https://www.hooklistener.com/learn/webhook-idempotency-and-deduplication) · [Stripe – process undelivered events](https://docs.stripe.com/webhooks/process-undelivered-events) · [Event sourcing como audit log](https://www.kurrent.io/blog/5-reasons-why-you-should-embrace-immutability-in-event-sourcing/) · [Taxonomia: categorias vs tags vs custom fields](https://www.supportbench.com/portal-taxonomy-design-categories-vs-tags-vs-custom-fields/)

---

### Apêndice — glossário de mapeamento
- **Fila (queue/group)** = departamento‑desk (`suporte_filas`).
- **Requester** = solicitante (`requester_id` interno **ou** `contato_id` externo).
- **Assignee** = agente responsável (`assignee_id`).
- **Canal** = por onde entrou (`canal`: chat_interno/whatsapp/email/manual).
- **Protocolo** = `RR-YYYYMMDD-XXXXXX` persistido em `suporte_tickets.protocolo`.
