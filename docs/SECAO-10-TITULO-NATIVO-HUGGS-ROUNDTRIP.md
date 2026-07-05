## 10. Título nativo-Huggs: nascimento organizado + round-trip idempotente com o Result

> **Onde encaixa:** esta seção estende o §3 (estágios do dinheiro/débito) e o §5 (modelo de dados) para o cenário-ALVO em que a despesa **NASCE no Huggs** (lançamento com documento → cria `contas_pagar`) e, quando a API do Result conectar, o título nascido no Huggs é **ENVIADO** ao Result (Huggs vira sistema de origem). Hoje o Huggs ESPELHA o Result (sync read-only, 50.987 títulos); a estrutura idempotente abaixo entra ANTES da API de write-back existir, porque é o que impede o sync de duplicar o título e debitar a verba 2× quando o round-trip fechar.
>
> **Premissa de verba (não muda):** o débito é sempre on-the-fly por `fn_orcamento_saldos` lendo `contas_pagar` por `departamento_id` (§3.2/§3.3-b). Nada nesta seção materializa saldo. O que muda é **garantir que o título nativo já nasça com `departamento_id` + `plano_contas_id`** (senão o débito não acontece — §3.4) e **garantir uma chave-ponte estável** para o sync do Result reconhecer o mesmo título econômico depois do round-trip.

### 10.0 Diagnóstico do write-path atual (o que hoje está quebrado no nascimento)

Três caminhos de escrita nativa, nenhum grava a organização de verba no nascimento:

| Caminho | Arquivo | `erp_id` gerado | `departamento_id` | `plano_contas_id` | `importado_api` |
|---|---|---|---|---|---|
| **A — Manual direto** | `CadastroTituloAP.tsx:176-238` → `crud-handlers.ts:388` (`handleIncluir`, erp_id na :425) | `API-{cod_integ}-{ts}` | **NULL** (schema `.strict()` rejeita) | **NULL** (não no schema) | `true` (:435) |
| **B — FPQ acceptPayment** | `useFinancialPaymentQueue.ts:452-560` (erp_id `FPQ-` na :487) | `API-FPQ-{code}-{ts}-{ts}` (duplo prefixo) | **NULL** (não propagado) | **NULL** (só `categoria_nome` textual :500) | `true` |
| **C — Omie** | (sem write nativo por tela) | — | — | — | `true` (mesmo lado do guard) |
| *(ref) Result sync* | `fn_transform_contas_pagar_rubysp` | `Empresa-Tipo-Numero-Seq-Fornecedor` | NULL (transform não mapeia) | preenchido via `historico_tpg`→`trade_chart_of_accounts.erp_code` | `false` |

**Quatro achados que esta seção resolve** (todos confirmados no código):
1. **`departamento_id` e `plano_contas_id` nunca são gravados no nascimento por nenhum caminho.** No caminho A há bug ativo: `CadastroTituloAP.tsx:192-193` envia `departamento_id`/`projeto_id`, mas `IncluirSchema` (`types.ts:14-41`) é `.strict()` e não contém esses campos → o payload inteiro é **rejeitado com 400** quando o usuário seleciona departamento; se deixar vazio, o título nasce sem verba. Pior: o dropdown popula `departamento` com `codigo||id` do ERP (inteiro), não o **UUID** de `departamentos(id)` que `contas_pagar.departamento_id` e `fn_orcamento_saldos` exigem — domínio errado mesmo que o schema aceitasse.
2. **Anexos do caminho FPQ se perdem:** `acceptPayment` cria o CP mas não copia `financial_payment_queue.attachments` para `cp_anexos` (único vínculo documento↔título, `anexo-handlers.ts:7-36`). O documento que originou a despesa fica órfão no FPQ e **não sobrevive** ao envio ao Result (`cp_anexos` é local; o payload de export não carrega binários).
3. **`natureza_lancamento` só é setado pelo transform do Result** (`provisionado`/`lancado` via `status_tpg`); o `/incluir` nativo nunca seta → título nativo fica no **default do banco**. `fn_orcamento_saldos` e a baseline (§4.1) filtram por natureza — título nativo com natureza default pode cair fora ou dentro da conta errada.
4. **O round-trip hoje NÃO fecha:** título nasce `MAN-*`/`API-*`; volta do Result com `Empresa-Tipo-...` (chave diferente); o guard do transform não o reconhece → **INSERT de um clone** → verba debitada 2×. Detalhe no §10.3.

### 10.1 Ciclo de vida do título nativo-Huggs (máquina de estados)

Nova coluna de controle em `contas_pagar`: **`origem_ciclo`** (enum abaixo) — ortogonal a `status` (pendente/pago/cancelado, que continua sendo o estado FINANCEIRO) e a `natureza_lancamento` (provisionado/lancado, o estágio ORÇAMENTÁRIO do §3.1). `origem_ciclo` é o estado de **procedência/reconciliação** e só existe para títulos nativos (Result-born fica `NULL` ou `sincronizado_result`).

```
        (tela lança c/ documento)                    (aprovação do gestor / empenho)
rascunho ─────────────────────────► empenhado ──────────────────────────────► oficial
  D0                                    D1                                       D2
                                                     (export p/ Result quando API existir)
                                                                                  │
                                                                                  ▼
                                                              enviado_result ──────► confirmado_result ──────► sincronizado_result
                                                                  D-EXP                D-ACK (Result           D-SYNC (sync casa por
                                                                                       devolve chave)          chave-ponte, faz UPDATE)
```

| Estado (`origem_ciclo`) | Ponto | O que acontece com a VERBA | Campos-chave em `contas_pagar` | Bloqueável? |
|---|---|---|---|---|
| **`rascunho`** | D0 | **Nada** — título ainda não conta em `fn_orcamento_saldos` (filtro `origem_ciclo <> 'rascunho'`). Reserva "leve" opcional em `department_expenses`/`budget_request` (só reserva, §10.2). | `departamento_id`, `plano_contas_id`, `codigo_lancamento_huggs` (chave-ponte, gerado JÁ aqui) preenchidos; `status='rascunho'` no domínio financeiro ou linha ainda só em `department_expenses` | Sim (gate interno) |
| **`empenhado`** | D1 | **Empenho reserva o saldo:** a aprovação do gestor consolida a reserva. Se veio de `budget_request`, a reserva vira empenho (a reserva "some" e o empenho a substitui — sem dupla contagem, §10.2). Ainda pode não haver título oficial. | igual + `status` avança; se ainda em `department_expenses`, `status='approved'` | Sim (gate valida saldo, §3.5) |
| **`oficial`** | D2 | **Comprometido de verdade:** título entra em `contas_pagar` não-cancelado com `valor_aberto>0`; `fn_orcamento_saldos` passa a somá-lo em `comprometido_erp`. A reserva/empenho interno **para de contar** pela dedup da cadeia (§3.2, §10.4). | `erp_id='MAN-'||uuid` (ou `API-*`), `natureza_lancamento='provisionado'` (setado no nascimento agora — §10.2), `importado_api=true`, `codigo_lancamento_huggs` = a chave-ponte | Não (já é título; só via cancelamento) |
| **`enviado_result`** | D-EXP | **Sem efeito na verba** (continua o mesmo `contas_pagar`, mesma linha, mesmo `departamento_id`). Só marca que o export saiu. | `+ erp_export_queue.export_status='sent'`, `payment_queue_id = contas_pagar.id` (reuso semântico PR-15) | Não |
| **`confirmado_result`** | D-ACK | **Sem efeito na verba** — o mesmo título ganha a chave do Result; NÃO cria linha nova. | **`erp_id` é REESCRITO de `MAN-*` para a chave do Result** (`Empresa-Tipo-...`) OU a chave vai em coluna nova `erp_id_result`; `codigo_lancamento_huggs` **preservado** | Não |
| **`sincronizado_result`** | D-SYNC | **Sem efeito na verba** — quando o lote do sync trouxer esse título, o transform casa pela chave-ponte e faz **UPDATE** (não INSERT). Verba debitada UMA vez, sempre pela mesma linha. | linha única, `erp_id` = chave Result, `codigo_lancamento_huggs` intacto | Não |

**Invariante central:** o título nativo é **uma única linha** em `contas_pagar` do berço (`rascunho`) ao túmulo (`sincronizado_result`). O `erp_id` pode mudar de valor no round-trip, mas a **linha** e o `departamento_id` não — por isso a verba nunca é debitada 2×. Estados de export vivem em `erp_export_queue`; estados de procedência em `origem_ciclo`; estado orçamentário em `natureza_lancamento`; estado financeiro em `status`. Quatro eixos ortogonais, sem colisão.

### 10.2 Nascimento organizado (departamento + plano de contas + empenho no ato)

**Regra de nascimento (aplicável aos caminhos A e B):** nenhum título nativo é criado sem `departamento_id` (UUID de `departamentos`) **e** `plano_contas_id` (conta real de `trade_chart_of_accounts`, NÃO `source_type+source_code`). Correções concretas:

1. **`IncluirSchema`/`UpsertSchema` (`types.ts:14-41`) passam a aceitar** `departamento_id uuid`, `plano_contas_id uuid` (ou `codigo_categoria` que o handler resolve para `plano_contas_id` via `trade_chart_of_accounts.code`), `natureza_lancamento` e `codigo_lancamento_huggs`. Como são `.strict()`, sem isso o payload é rejeitado (bug atual §10.0-1).
2. **`CadastroTituloAP.tsx:192-193`** passa a enviar o **UUID** do departamento interno (não `codigo||id` do ERP). O dropdown deve popular com `departamentos(id)`, não com o código do ERP — senão `fn_orcamento_saldos` (que junta por `dep.id = cp.departamento_id`) não encontra a verba.
3. **`handleIncluir` (`crud-handlers.ts:429-437`)** grava os quatro campos no INSERT, define `natureza_lancamento='provisionado'` por padrão para título nativo (compromisso real desde o nascimento, coerente com §3.1/§4.1) e **gera `codigo_lancamento_huggs = gen_random_uuid()` se vier vazio** (a chave-ponte imutável — §10.3).
4. **Caminho B (`acceptPayment`, `useFinancialPaymentQueue.ts:489-502`)** propaga `department_id` (o UUID que já existe em `department_expenses.department_id`) e resolve `plano_contas_id` — hoje manda só `categoria_nome` textual descartável. É o mesmo gap listado em **§3.4 item 2**; aqui ele ganha o campo `plano_contas_id` além do `departamento_id`.
5. **Anexos:** `acceptPayment` passa a copiar `financial_payment_queue.attachments` → `cp_anexos` (via `handlePostAnexos`, `anexo-handlers.ts:7`) com o `conta_pagar_id` recém-criado, para o documento sobreviver ao virar título (§10.0-2).

**Quando o empenho acontece (concilia com "budget_request = só reserva"):**
- O **empenho da verba acontece na APROVAÇÃO, não na digitação do título.** Sequência: `rascunho` (digitação, verba intocada) → aprovação do gestor (`department_expenses.status='approved'` = **D1 empenho**, o gate valida saldo contra `fn_orcamento_saldos` ANTES de deixar aprovar) → título oficial em `contas_pagar` (**D2**).
- **`budget_request` continua sendo SÓ reserva** (decisão prévia): é o "cartão pré-autorizado" de D0/D1 — segura o saldo enquanto o título ainda não existe, mas **não é** o débito. Quando o título vira `oficial` em `contas_pagar`, o `budget_request`/`department_expense` reserva **para de contar** pela dedup da cadeia `payment_queue_id → contas_pagar_id` (§3.2). Ou seja: a reserva (`budget_request`) e o empenho (`department_expenses.approved`) e o comprometido (`contas_pagar`) são **o mesmo dinheiro em três estágios de maturidade**, e `fn_orcamento_saldos` conta cada real UMA vez escolhendo o estágio mais maduro disponível (título oficial > empenho interno > reserva).

Vínculo à distribution/período no ato: o título não precisa de `distribution_id` (a distribution é derivada por `departamento_id` + período que contém `data_emissao` — §3.2). Mantém-se a fonte única `contas_pagar`; **não** se popula `department_expenses.distribution_id` (que hoje é estruturalmente zero, §5.2) para evitar segunda origem de número.

### 10.3 Idempotência do round-trip (o coração)

**Estratégia de chave: chave-ponte estável carimbada no nascimento e ecoada pelo Result.**

O `erp_id` **não pode** ser a chave de reconciliação porque ele MUDA no round-trip (de `MAN-*`/`API-*` para `Empresa-Tipo-Numero-Seq-Fornecedor`, reconstruído em `connector-rubysp/src/connector-contas-pagar.js:65`). A chave-ponte precisa ser **imutável e independente do Result**:

- **Campo eleito: `contas_pagar.codigo_lancamento_huggs`** (já existe — era `codigo_lancamento_omie`; hoje ocioso no fluxo Result). Recebe um `uuid` no nascimento (§10.2-3). Alternativa equivalente: `codigo_integracao` (hoje sempre NULL, usado só como flag de exclusão no guard). Recomendação: **`codigo_lancamento_huggs`** para não sobrecarregar `codigo_integracao`, que o guard já usa com outra semântica.

**Fluxo dos 3 saltos:**

1. **Nascimento (Huggs):** grava `codigo_lancamento_huggs = <uuid>` + `origem_ciclo='oficial'`. Verba já debitada por esta linha, via `departamento_id`.
2. **Export (Huggs → Result):** `erp-export-payment/buildPayload` (`index.ts:142-186`) inclui um campo `huggs_ref = codigo_lancamento_huggs` no payload. `origem_ciclo='enviado_result'`.
3. **Retorno (Result → Huggs), via `erp-webhook-inbound`:** o Result devolve `referencia_erp` (a chave dele) **e ecoa `huggs_ref`**. O webhook localiza a linha por `codigo_lancamento_huggs = huggs_ref` e **atualiza a MESMA linha** (`origem_ciclo='confirmado_result'`, grava a chave do Result). **NÃO cria linha nova.**

**Correção obrigatória no `erp-webhook-inbound` (bug pré-existente, §WRITE-BACK):** hoje ele escreve em colunas que **não existem** — `erp_referencia`, `erp_synced_at`, `conta_pagar_id` (linhas 161-182) — e o UPDATE falha silenciosamente (`filaAtualizada=false`, sem throw), então **a chave do Result que voltar não é persistida em lugar nenhum**. Antes de ligar o round-trip é preciso: (a) trocar o filtro para as colunas reais (`erp_export_queue.payment_queue_id` = `contas_pagar.id`; `erp_titulo_id` já existe e está órfã — usar para a chave do Result); (b) ancorar a reconciliação no título por `codigo_lancamento_huggs`, não pela fila.

**Mudança no `fn_transform_contas_pagar_rubysp` (o ponto crítico — migration `20260705053801`):**

O staging `erp_contas_pagar_rubysp` precisa passar a trazer o `huggs_ref` que o Result ecoa (nova coluna `codigo_lancamento_huggs` no staging; o connector `connector-rubysp/src/connector-contas-pagar.js` mapeia o campo que o Result devolver). Com isso:

- **UPDATE (hoje linhas 10-37, casa por `WHERE cp.erp_id = s.erp_id`):** passa a casar por
  ```sql
  WHERE (cp.erp_id = s.erp_id
         OR (s.codigo_lancamento_huggs IS NOT NULL
             AND cp.codigo_lancamento_huggs = s.codigo_lancamento_huggs))
    AND COALESCE(cp.importado_api,false) = false  -- guard mantém-se (ver ressalva abaixo)
  ```
  e, quando o match for pela chave-ponte, **promove** a linha nativa: `SET erp_id = s.erp_id` (adota a chave definitiva do Result), `origem_ciclo='sincronizado_result'`, atualiza valores. **Preserva `departamento_id`** (o transform NÃO deve sobrescrever `departamento_id` do título nativo — é a coluna que ancora a verba; adicionar `departamento_id = COALESCE(cp.departamento_id, s.departamento_id)` para nunca zerar).
- **INSERT (hoje linha 57, `WHERE NOT EXISTS (... cp.erp_id = s.erp_id)`):** ganha um segundo predicado de não-clonagem —
  ```sql
  WHERE NOT EXISTS (
    SELECT 1 FROM contas_pagar cp
    WHERE cp.erp_id = s.erp_id
       OR (s.codigo_lancamento_huggs IS NOT NULL
           AND cp.codigo_lancamento_huggs = s.codigo_lancamento_huggs))
  ```
  Assim o título que voltou do Result (com `erp_id` novo mas mesmo `huggs_ref`) **não é inserido como clone** — ele já foi promovido pelo UPDATE acima.

**Ressalva sobre o guard `importado_api=false`:** hoje o guard do UPDATE (linhas 36-37) exclui todo nativo (`importado_api=true`). Se mantido literal, o UPDATE de promoção acima **nunca casaria** o título nativo (que é `importado_api=true`). Solução: o predicado de match por `codigo_lancamento_huggs` é uma **exceção explícita ao guard** — quando o match é pela chave-ponte, o UPDATE é permitido MESMO com `importado_api=true`, porque é exatamente o round-trip legítimo:
```sql
AND (COALESCE(cp.importado_api,false) = false
     OR (s.codigo_lancamento_huggs IS NOT NULL
         AND cp.codigo_lancamento_huggs = s.codigo_lancamento_huggs))
```

**Janela de corrida (título já no Result, mas ainda não confirmado no Huggs quando o sync roda):** cenário — o export saiu (`enviado_result`), o Result já processou e o título entra no lote do sync ANTES do webhook `confirmado_result` chegar. Nesse instante o `contas_pagar` nativo ainda tem `erp_id='MAN-*'` e **nenhum `erp_id` do Result**, mas **já tem `codigo_lancamento_huggs`**. Como o lote do sync traz o `huggs_ref` ecoado, o transform casa pela **chave-ponte** (não pelo `erp_id`) → faz o UPDATE de promoção, **sem depender do webhook**. O webhook, quando chegar, encontra a linha já promovida (idempotente: `origem_ciclo` já é `sincronizado_result`, o UPDATE é no-op). **A chave-ponte torna o webhook e o sync mutuamente idempotentes** — qualquer um dos dois que chegue primeiro reconcilia; o segundo não duplica. Requisito para isso funcionar: o Result **precisa ecoar o `huggs_ref` já no primeiro lote de sync**, não só no webhook. Se não ecoar no sync (só no webhook), há janela de clonagem — ver risco R1 (§10.6).

### 10.4 Verba source-agnostic (o mesmo mecanismo serve os dois)

`fn_orcamento_saldos` (§3.2) lê `contas_pagar` por `departamento_id` + janela — **não olha a procedência**. Logo funciona identicamente para Result-born e Huggs-born **desde que `departamento_id` esteja setado**. É por isso que §10.2 é pré-requisito duro: título nativo sem `departamento_id` cai no bucket "(sem verba)" e não debita nada (falha silenciosa de controle).

**Dupla contagem no período de transição — reusar e estender a dedup da §3.2:** durante a transição, o mesmo gasto pode existir como (a) `department_expense` interno (reserva/empenho), (b) `financial_payment_queue` aceito, e (c) `contas_pagar` oficial. A dedup já desenhada — cadeia `department_expenses.payment_queue_id → financial_payment_queue.contas_pagar_id` — resolve: item que já virou CP conta **só** no ERP (`comprometido_erp`), nunca no interno (`comprometido_interno`). Extensão para o round-trip:

- Quando o título nativo é promovido a `sincronizado_result` (troca `erp_id` `MAN-*` → `Empresa-Tipo-...`), **continua sendo a mesma linha `contas_pagar.id`** → a cadeia `financial_payment_queue.contas_pagar_id` **não quebra** (aponta para o `id`, não para o `erp_id`). A dedup sobrevive ao round-trip automaticamente. **Isto só é verdade porque o transform faz UPDATE (mesma linha), não INSERT (linha nova)** — se clonasse, o `contas_pagar_id` da FPQ apontaria para o clone `MAN-*` órfão e a linha `Empresa-Tipo-...` nova seria contada EM DOBRO (empenho interno + clone ERP). Fecha o círculo do §10.3.
- Validação (estende V5, §9): `fpq_com_cp` deve continuar batendo após o round-trip; nenhuma linha `contas_pagar` com o mesmo `codigo_lancamento_huggs` deve existir em duplicidade —
  ```sql
  SELECT codigo_lancamento_huggs, count(*)
  FROM contas_pagar
  WHERE codigo_lancamento_huggs IS NOT NULL AND status <> 'cancelado'
  GROUP BY 1 HAVING count(*) > 1;   -- esperado: 0 linhas
  ```

### 10.5 Impacto nas fases (F0–F4)

O nascimento organizado é **pré-requisito do débito** (F2) e a estrutura idempotente do round-trip entra **antes** da API do Result (que fica bloqueada em terceiro). Reordenação:

| Fase | Adição desta seção | Depende de |
|---|---|---|
| **F2 (já existente — Débito + saldos)** | Absorve o **encanamento do nascimento** que a §3.4 já pedia, ampliado: `plano_contas_id` além de `departamento_id` nos caminhos A e B; `IncluirSchema`/`UpsertSchema` aceitam os campos (fim do bug `.strict()` §10.0-1); `natureza_lancamento='provisionado'` no nascimento nativo; anexos FPQ→`cp_anexos`. `fn_orcamento_saldos` já é source-agnostic (§10.4) — nenhuma mudança nela. | itens 1–3 da §3.4 |
| **F2.5 (NOVA sub-fase — "Chave-ponte + procedência")** | `contas_pagar.codigo_lancamento_huggs` gerado no nascimento; `contas_pagar.origem_ciclo` (enum); filtro `origem_ciclo<>'rascunho'` em `fn_orcamento_saldos`. **Estrutura pura, sem API Result** — é a fundação idempotente instalada antes de qualquer write-back. | F2 |
| **F2.6 (NOVA sub-fase — "Transform idempotente")** | Reescrever match do `fn_transform_contas_pagar_rubysp` (UPDATE por `erp_id OR codigo_lancamento_huggs` com exceção ao guard; INSERT com predicado anti-clone); staging `erp_contas_pagar_rubysp` ganha coluna `codigo_lancamento_huggs`; connector mapeia o eco. **Roda a seco:** sem títulos nativos exportados ainda, o predicado extra é inócuo (todo `s.codigo_lancamento_huggs` é NULL) — instala-se sem risco e fica pronto. | F2.5 |
| **F3 (já existente — Alertas + suplementação)** | Gate interno de bloqueio (§3.5) opera sobre `department_expenses`/FPQ no estado `rascunho`/`empenhado` — validação de saldo ANTES do empenho. Sem mudança estrutural nova. | F2.5 |
| **F4 (já existente — Rolling + profundidade) / bloqueada pela API Result** | **Write-back real:** corrigir `erp-webhook-inbound` (colunas inexistentes, §10.3); `buildPayload` inclui `huggs_ref`; ligar `erp-export-payment` quando `N8N_ERP_EXPORT_WEBHOOK_URL`/`ERP_REST_API_URL` existirem; estados `enviado_result`/`confirmado_result`/`sincronizado_result` passam a transicionar de verdade. Até a API existir, o título nativo vive feliz em `oficial` — a verba já funciona. | F2.6 + API Result |

**Ordem de segurança:** F2.5 e F2.6 são **estruturais e inócuas sem tráfego** — podem entrar junto com F2. A promoção real (F4) só acende quando a API do Result conectar, mas quando conectar **a idempotência já está instalada e testada a seco**, então o primeiro título nativo que fizer round-trip não clona.

### 10.6 Riscos e decisões em aberto (específicos desta seção)

| # | Risco / Decisão | Recomendação |
|---|---|---|
| **R1** | **O Result ecoa o `huggs_ref` no LOTE DE SYNC, ou só no webhook?** Se ecoar só no webhook, a janela de corrida (§10.3) reabre: um lote de sync que chegue antes do webhook não tem como casar pela chave-ponte → clona. | **Exigir o eco no próprio lote de sync** (o campo tem de vir no SELECT que o `connector-rubysp` puxa), não só no webhook. É a condição que torna sync e webhook mutuamente idempotentes. Se o Result não puder ecoar no sync, adotar R2 como rede. |
| **R2** | **`erp_id` reescrito in-place (`MAN-*`→`Empresa-Tipo-...`) vs coluna nova `erp_id_result`.** Reescrever perde o histórico da chave nativa; coluna nova preserva mas exige o guard e todo o resto olharem duas colunas. | **Coluna nova `erp_id_result`** + manter `erp_id` nativo intacto. Custa uma coluna, mas: (a) preserva rastreabilidade; (b) o `UNIQUE` de `erp_id` não colide; (c) se a chave-ponte falhar, ainda dá para reconciliar por `erp_id_result` sem ter destruído a origem. O match do transform passa a olhar `erp_id OR erp_id_result OR codigo_lancamento_huggs`. |
| **R3** | **Guard `importado_api=false` como único fio de proteção (§10.0):** todo write-path nativo depende de lembrar de setar `importado_api=true`; um caminho futuro que esqueça deixa o Result **pisar** no título nativo. A exceção por chave-ponte (§10.3) alarga o furo se mal escrita. | Tornar `importado_api=true` **default de coluna** para inserts nativos (não confiar no app), e cobrir com a query de duplicidade da §10.4 no cron de validação. A exceção ao guard só vale quando `codigo_lancamento_huggs` casa **exatamente** — nunca por `erp_id` sozinho. |
| **R4** | **Anexos não sobrevivem ao Result (§10.0-2):** o documento fica só no Huggs (`cp_anexos`); o payload de export não carrega binário. Ao voltar pelo sync, o título Result não referencia o `cp_anexos` nativo. | Aceitar que o **documento é autoridade do Huggs** (sistema de origem) — o Result recebe metadados, não o binário. Garantir que a promoção do transform **preserve o vínculo `cp_anexos.conta_pagar_id`** (é por `id`, sobrevive ao UPDATE). Não tentar espelhar anexo no Result nesta fase. |

**Decisão de nomenclatura pendente (D6, para a §8):** confirmar via prompt Lovable que `contas_pagar.codigo_lancamento_huggs` está de fato ocioso no fluxo Result antes de reaproveitá-lo como chave-ponte (era `codigo_lancamento_omie` — checar se algum título Omie ainda o usa; se usar, cair para `codigo_integracao` com a semântica de exclusão ajustada).
