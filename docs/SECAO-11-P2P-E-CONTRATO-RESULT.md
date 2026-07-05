## 11. Procure-to-Pay multi-departamento + contrato de dados do Result

> **Onde encaixa:** esta seção estende o §3 (estágios do dinheiro/débito), o §3.5 (bloqueio nos 2 gates internos) e a §10 (nascimento organizado + round-trip idempotente) para o cenário-ALVO em que **QUALQUER departamento** — não só o Trade Marketing — origina despesa no Huggs, e a despesa passa por um ciclo P2P completo (requisição → cotação → alçada → empenho → título → pagamento → envio Result) antes de virar `contas_pagar`. Responde a três pedidos: (1) **generalizar a engine de aprovação** hoje presa ao Trade; (2) **empenhar a verba na aprovação** de N cotações (controle ANTES do lançamento) debitando um **departamento OU uma campanha**; (3) **fechar o contrato de dados do Result** — garantir que o título nasce com TODOS os campos obrigatórios do write-back.
>
> **Premissa de verba (não muda, herdada §3.2/§10.4):** o débito do *comprometido oficial* é sempre on-the-fly por `fn_orcamento_saldos` lendo `contas_pagar` por `departamento_id`. Nada aqui materializa saldo de título. O que esta seção adiciona é o **estágio anterior** — o *empenho* (reserva firme na aprovação da requisição), que é `comprometido_interno` com dedup, exatamente como o §3.2 já previu para D1/D2, agora com um mecanismo de reserva real (hoje inexistente fora do Trade).
>
> **Achado central (TL;DR):** a espinha agnóstica de departamento **já existe e funciona** — `financial_payment_queue` (FPQ) + `useFinancialSubmission` + `FinancialSubmissionForm` + `useFinancialPaymentQueue.acceptPayment` → `contas-pagar-api`. O que continua preso ao Trade é só **(a) a alçada por valor** (`trade_approval_levels`/`trade_user_approval_levels`) e **(b) o empenho de verba** (`trade_budget_reserves` + triggers). O caminho `department_expense` já é um espelho funcional do Trade, só que com alçada pobre (gerente único) e **sem empenho**. Requisição/cotação (subir N orçamentos e escolher) **não existe em lugar nenhum** — é o único bloco 100% greenfield.

### 11.1 O ciclo P2P alvo — aterrissado nas tabelas reais

Sete estágios, mapeados às três máquinas de estado que já convivem (financeira `status`, orçamentária `natureza_lancamento`, procedência `origem_ciclo` da §10) e ao ponto de débito D1–D6 do §3.1:

| # | Estágio P2P | Onde vive (tabela/fluxo) | Existe hoje? | Efeito na verba | Estágio orçamentário (§3.1) | `origem_ciclo` (§10.1) |
|---|---|---|---|---|---|---|
| 1 | **Requisição** (pedido de compra interno) | `expense_requests` **(A CRIAR)** — herda `attachments jsonb` + bucket privado `attachments` | **NÃO** (gap total) | nada | — | (pré-título) |
| 2 | **Cotação** (N orçamentos, escolhe 1) | `expense_request_quotes` **(A CRIAR)**, N linhas por request, PDF por cotação | **NÃO** | nada | — | (pré-título) |
| 3 | **Alçada** (aprovação por valor×depto×papel) | motor genérico **(A CRIAR promovendo `trade_approval_levels`)**; gate BEFORE molde `check_campaign_expense_limit` | parcial (só Trade, e sem enforcement por valor) | nada | — | (pré-título) |
| 4 | **Empenho** (reserva firme ao aprovar) | `budget_commitments` **(A CRIAR)** polimórfico → `distribution_id` OU `campaign_id`; molde `trade_budget_reserves` | só Trade (`trade_budget_reserves`) | **RESERVA** o saldo (comprometido_interno) | COMPROMETIDO (empenho) | `rascunho`→`empenhado` (D1) |
| 5 | **Título** (nasce em `contas_pagar`) | `useFinancialSubmission` → FPQ → `acceptPayment` → `contas-pagar-api` | **SIM** (agnóstico) | **COMPROMETIDO oficial** (empenho para de contar, dedup) | COMPROMETIDO (provisionado) | `oficial` (D2/D3) |
| 6 | **Pagamento** (baixa) | `MovimentoContasPagar`/`LancarPagamentoSchema.forma_pagamento` (`types.ts:89`) | SIM | **REALIZADO** | REALIZADO | `oficial` | 
| 7 | **Envio Result** (write-back) | `erp-export-payment` → `erp-webhook-inbound`; chave-ponte `codigo_lancamento_huggs` (§10.3) | **NÃO** (API Result ausente) | nenhum (mesma linha) | — | `enviado_result`→`sincronizado_result` |

**Como conversa com a máquina `origem_ciclo` da §10:** os estágios 1–4 são o *pré-nascimento* que a §10 mencionou de passagem mas não detalhou (o `rascunho` que "opcionalmente" tem reserva em `budget_request`). Esta seção materializa esse pré-nascimento: a **requisição+cotação vive fora de `contas_pagar`** (em `expense_requests`), e só o **empenho aprovado (estágio 4)** cria a reserva que a §10.2 chamou de "cartão pré-autorizado". O salto 4→5 (empenho→título) é exatamente a transição `empenhado`→`oficial` da §10.1: o `budget_commitment` **para de contar** quando o `contas_pagar` nasce, pela mesma dedup da cadeia `payment_queue_id → contas_pagar_id` (§3.2/§10.4). Nada de novo na `fn_orcamento_saldos` — ela ganha só uma **terceira fonte de `comprometido_interno`**: além de `department_expenses` (D1) e FPQ (D2), passa a ler `budget_commitments` ativos sem título (o empenho da requisição). Ver §11.3.

**Invariante do ciclo:** cada real é contado UMA vez, no estágio mais maduro disponível — **título oficial > empenho (`budget_commitment`) > reserva leve (`department_expense.approved`)**. É a mesma regra do §10.2, agora com o empenho como camada explícita entre reserva e título.

### 11.2 Generalizar a engine de aprovação além do Trade

**O que NÃO redesenhar (a espinha agnóstica já pronta — reusar como está, lição "preservar visual, trocar só a origem"):**

| Peça | Arquivo | Papel | Por que já serve |
|---|---|---|---|
| Fila única | `financial_payment_queue` (`20260204215412`; `attachments` em `20260204222144:3`) | barramento aprovado→pagar | parametrizada por `source_type`; já passa `trade_entry`/`department_expense`/`event_expense` |
| Insert na fila | `src/hooks/useFinancialSubmission.ts:57-122` | grava supplier/documento/vencimento/portador/attachments/empresa_id | genérico; gera code `TRD/DEP/EVT-` (`:105`) |
| Form de envio | `src/components/shared/FinancialSubmissionForm.tsx` (campos obrig. `:37`) | fornecedor/documento/portador/vencimento | **compartilhado** — Trade E departamento usam o MESMO |
| Aceite → título | `src/hooks/useFinancialPaymentQueue.ts:452-560` (`acceptPayment`, título via `contas-pagar-api` `:504`; `syncStatusToSource` `:111-175`) | vira `contas_pagar` | monta payload só de campos genéricos da fila; nada Trade-específico |

**O que EXTRAIR do Trade para um motor agnóstico de departamento (o único acoplamento real):**

| Camada acoplada ao Trade | Artefato preso | Ação de generalização |
|---|---|---|
| **Alçada por valor** | `trade_approval_levels` (`level_number`, `role_name`, `max_approval_amount`, `is_active`), `trade_user_approval_levels` (N:N usuário↔nível); tela `TradeAdminApprovalLevels.tsx:42-72`, `ApproverManagementDialog.tsx` | Promover a `approval_levels` **por departamento** (ou global com escopo por `department_id`), com `max_approval_amount`. Portar `TradeAdminApprovalLevels` para um `AdminApprovalLevels` parametrizado. |
| **Enforcement (o gap crítico)** | hoje o gate de entrada no `TradeApprovalHub.tsx:43` é só `isAdminOrSupervisor`; **não há checagem "valor > `max_approval_amount` do meu nível → escala/bloqueia"** no ato da aprovação (a tabela de níveis existe mas não amarra) | **Fechar o gap:** trigger BEFORE / validação síncrona no ato de aprovar, molde já em produção `check_campaign_expense_limit` (`20260123213908:205-236`, o mesmo do §3.5). |
| **Alçada pobre do departamento** | `useManagerPendingExpenses.ts:29-46`: alçada = `role in ('admin','supervisor')` OU ser `departamentos.responsavel_id`. Sem banda de valor, sem níveis (R$50 e R$500k caem no mesmo gerente); `DepartmentApprovalHub.tsx:78` só deixa `isManager` entrar | **Substituir** por `approval_levels` — o departamento passa a ter a mesma alçada por valor do Trade. |

**O que PRESERVA o Trade funcionando (não quebrar o que roda):** o Trade continua com suas telas (`TradeApprovalHub`, `CampaignsApprovalTable`, `EntriesApprovalTable`), suas tabelas (`trade_campaigns`, `trade_financial_entries`), e seu débito on-the-fly (`AprovarLancamentoDialog.tsx:141` consome `spent_amount`). A generalização é **aditiva**: cria `approval_levels`/`budget_commitments` genéricos e faz o Trade passar a *ler* deles no futuro, mas o caminho Trade atual (`trade_budgets` + `trade_budget_reserves`) permanece intacto até uma migração explícita (ver R5, §11.6). Precedente de bloqueio na alçada: `check_campaign_expense_limit` (`20260123213908:205-236`) é o molde literal — só que ele é teto *a posteriori* sobre o realizado; o motor genérico usa o mesmo padrão de trigger BEFORE para validar *a priori* contra `fn_orcamento_saldos`.

**Painel do financeiro é agnóstico — confirmado:** `useFinancialPaymentQueue.ts` trata `dep:<nome>` genericamente (`:217-223`); `acceptPayment` monta o título só de campos da fila (`:489-502`); `syncStatusToSource` tem branch de primeira classe para `event_expense`/`department_expense`/`trade_entry` (`:111-175`). **Viés residual a limpar:** `trade_investment` e `trade_campaign` estão no `SourceType` union (`:10`) mas **não têm produtor de fila nem branch de sync** — são tipos meio-mortos (a campanha nunca insere na FPQ; ver §11.3). Não são gap a corrigir, são a **prova de que a campanha é empenho, não título**.

### 11.3 Empenho da verba na aprovação (o "controle ANTES do lançamento")

**O molde já existe, funciona, e está preso ao Trade** — `trade_budget_reserves` (`20251021164614:43-155`; hardening `20251201061853:18`):
- `trade_budgets` (`20251007173756:35`): `total_amount`, `spent_amount`, `reserved_amount`, e a coluna gerada `available_amount = total − spent − reserved` (`GENERATED ALWAYS ... STORED`, `20251021164614:74`) — **os 3 baldes: teto / reservado(empenho) / gasto**.
- `trade_budget_reserves` (`budget_id`, `campaign_id`, `reserved_amount`, `status ∈ active/released/consumed`): a reserva/empenho.
- Trigger `validate_budget_reserve` (`20251021164614:112`, BEFORE INSERT): bloqueia se `available_amount < reserved_amount` — **"não empenha mais que o saldo"**.
- Trigger `update_budget_reserved_amount` (`20251021164614:136`): AFTER INSERT/UPDATE — reserva `active` faz `reserved_amount += NEW`; virar `released`/`consumed` faz `reserved_amount -= OLD` — **débito/estorno automático**.

**O buraco do lado do orçamento por departamento (confirmado no schema):** `budget_distributions` **não tem tabela de reserva** e a view `vw_budget_distribution_kpis` **hard-coda `valor_comprometido = 0`** (`20260625144549:238`) — o balde "comprometido" simplesmente não é alimentado. `department_expenses` já tem os ganchos (`distribution_id`, `plan_category_id`, `period_id` — `types.ts:14142-14182`) mas **nenhum trigger debita** ao aprovar. Ou seja: o mecanismo de empenho existe (Trade) e o lugar para empenhar existe (`budget_distributions`), mas **não há ponte**.

**Desenho do empenho genérico — `budget_commitments` polimórfico (generaliza `trade_budget_reserves`):**

```sql
CREATE TABLE budget_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- alvo polimórfico: empenha contra o DEPARTAMENTO ou contra a CAMPANHA
  distribution_id uuid REFERENCES budget_distributions(id),   -- verba de depto
  campaign_id     uuid REFERENCES trade_campaigns(id),        -- sub-verba de campanha
  expense_request_id uuid REFERENCES expense_requests(id),    -- origem (a requisição aprovada)
  valor_empenhado numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',                      -- active | released | consumed
  contas_pagar_id uuid REFERENCES contas_pagar(id),           -- preenchido quando vira título → dedup
  CHECK (num_nonnulls(distribution_id, campaign_id) = 1)      -- empenha em EXATAMENTE um alvo
);
```

**Como o empenho aparece em `fn_orcamento_saldos` (extensão mínima, coerente §3.2):** hoje `comprometido_interno` soma D1 (`department_expenses.approved`) + D2 (FPQ aceito) com dedup pela cadeia. Adiciona-se uma **terceira parcela**: `budget_commitments` com `status='active'` **e `contas_pagar_id IS NULL`** (empenho ainda sem título). A dedup é a mesma lógica da §3.2/§10.4 estendida: **quando o empenho vira título, grava-se `budget_commitments.contas_pagar_id` e o `status` vai a `consumed`** → ele sai de `comprometido_interno` e o `contas_pagar` entra em `comprometido_erp`. Cada real conta uma vez. A cadeia de dedup fica: `budget_commitments.contas_pagar_id → contas_pagar.id` (empenho→título), casada com `financial_payment_queue.contas_pagar_id` (§3.2) — o item que já é `contas_pagar` nunca conta como empenho.

**Debita departamento OU campanha (o pedido literal):** o alvo do empenho é escolhido na aprovação da requisição:
- **Empenho de departamento:** `distribution_id` preenchido → reserva bate contra `budget_distributions.valor_alocado` do período (via `fn_orcamento_saldos`), gate valida `available` ANTES de aprovar (molde `validate_budget_reserve`).
- **Empenho de campanha:** `campaign_id` preenchido → reserva bate contra a verba da campanha. **Verba de campanha = sub-verba de departamento:** hoje `trade_budgets` **não tem `department_id`** (campanha e depto são hierarquias paralelas desconexas). Para a campanha ser sub-verba, a campanha precisa carregar `department_id`/`distribution_id`, e o empenho de campanha **também conta contra o teto do departamento** — o `budget_commitment` de uma campanha rola para cima na alocação do depto dono. Decisão de modelagem em R2 (§11.6): dar `department_id` à campanha (opção A) OU deixar o commitment polimórfico resolver o rollup (opção B).

**`check_campaign_expense_limit` como precedente — e sua limitação:** `20260123213908:205-236` bloqueia gasto de campanha se `(total_gastos_aprovados + novo) > verba_orcada` (`:224`). É teto **sobre o realizado** (valida só quando a despesa vira `aprovado`), **não mantém contador de comprometido nem reserva a priori**. É controle *a posteriori*. O `budget_commitment` é o upgrade: reserva firme *a priori*, com contador (`reserved_amount`) e estorno. O `check_campaign_expense_limit` continua válido como *segundo* teto (não deixa o realizado furar mesmo com empenho subestimado).

**Empenho de N cotações:** a requisição (`expense_requests`) sobe N `expense_request_quotes`; a aprovação **escolhe 1 cotação** e cria **1 `budget_commitment`** pelo valor da cotação escolhida (não pela soma das N). Anexos das N cotações herdam `attachments jsonb` + bucket privado `attachments` (mesmo padrão de `department_expenses`/`corporate_event_expenses`, `20260213002338`/`20260213160601`) — não há gap de upload aqui. **O gap de anexo é no título** (§11.4 e §10.0-2): `contas_pagar` não tem coluna de anexos, os PDFs morrem no FPQ.

### 11.4 Contrato de dados do Result (checklist de nascimento)

**O modelo real do Result** (fonte: `connector-rubysp/src/connector-contas-pagar.js:34-93`): a PK de um título é **composta de 5 campos** — `Empresa_tpg`, `Tipo_tpg`, `Numero_Tpg`, **`Seq_tpg`** (a parcela), `Fornecedor_tpg` (FK → `dbo.Fornecedor.ID_for`). O `erp_id` do Huggs é a concatenação deles (`:65`). **Parcela = `Seq_tpg` faz parte da PK** → um título de 3 parcelas são **3 linhas** com `Seq` 1/2/3. O envio precisa emitir **uma linha por parcela**.

Escrita Huggs no nascimento: `handleIncluir` (`crud-handlers.ts:388-463`) validado por `IncluirSchema` (`_shared/contas-pagar/types.ts:14-41`, `.strict()`); form em `CadastroTituloAP.tsx:183-199`.

**Tabela campo-a-campo (obrigatório? / equivalente Huggs / preenchido no nascimento? / gap):**

| Bloco | Campo Result | Obrig.? | Equivalente Huggs | No nascimento? | GAP |
|---|---|---|---|---|---|
| **Fornecedor** | `ID_for` (FK/PK do título) | **SIM** | `fornecedores.codigo_externo` (validado `crud-handlers.ts:411`); form manda `codigo_cliente_fornecedor` (`CadastroTituloAP.tsx:185`) | SIM (por código) | Vínculo por **texto/código validado só no app, sem FK no banco**; não há `fornecedor_id uuid`; INSERT trata `23503` genérico (`:447`) |
| | `CNPJ_For` | **SIM p/ Result** | `fornecedores.cnpj` (NOT NULL) | **NÃO no título** (mora no cadastro) | Se o fornecedor escolhido não tiver CNPJ, título nasce "válido" no Huggs mas **irrejeitável no Result**; sem gate de completude no ato |
| | dados bancários | operacional | `fornecedores.banco/agencia/conta/chave_pix/tipo_pix` | NÃO no título | OK ficar no cadastro; mas **duas tabelas** (`fornecedores` × `fabrica_fornecedores`) sem canônica definida p/ AP — o título nativo referencia `fornecedores` (`:411`) |
| | `condicao_pagamento`/`Prazo_For` | condicional | só `prazo_pagamento_padrao` (não usado no cálculo de vencimento) | NÃO | prazo do fornecedor não alimenta vencimento/parcelamento; sem condição de pagamento estruturada |
| **Título** | `Empresa_tpg` | **SIM (PK)** | `contas_pagar.empresa_id` (default 5, `:435`) | SIM | ok |
| | `Tipo_tpg` | **SIM (PK)** | `contas_pagar.tipo_documento` | **NÃO** (não há campo Tipo na tela) | Sem `Tipo`, o Result não monta a PK; o form nunca coleta |
| | `Numero_Tpg` | **SIM (PK)** | `contas_pagar.numero_documento` (opcional `:194`) | opcional | título pode nascer sem número → PK incompleta na origem |
| | `Valor_tpg`/`Saldo_tpg` | sim | `valor_original`/`valor_aberto` (`:431`) | SIM | ok |
| | `Emissao_tpg`/`Vencimento_tpg` | sim | `data_emissao`/`data_vencimento` (`data_vencimento` obrig. `types.ts:17`) | Vencimento SIM; Emissão opcional | ok (emissão pode nascer null) |
| | `Status_Tpg` (0=provisão) | sim | `natureza_lancamento` | **NÃO setado** (default banco) | Result espera `Status`; §10.2 propõe default `provisionado` |
| | chave-ponte (idempotência) | — | `codigo_lancamento_huggs` | **NÃO gerado** + **tipo errado** (`number` em `types.ts:10305`; §10.3 quer `uuid`) | bloqueio de round-trip; §10.3 |
| **Parcela** | `Seq_tpg` (1..N, na PK) | **SIM (PK)** | `contas_pagar.parcela`/`numero_parcela`/`total_parcelas` | **QUEBRADO** | ver bloco abaixo |
| **Forma/Portador** | `Portador_tpg` (banco/carteira) | sim (operacional) | `contas_pagar.portador`/`portador_id`/`portador_codigo_erp` | **NÃO** (form não coleta; `IncluirSchema` aceita opcional mas o form não envia) | título nasce sem portador; Result espera |
| | `id_conta_corrente` | operacional | `contas_pagar.id_conta_corrente` (`:190`,`:435`) | SIM | ok |
| | `Forma_Mtpg` (dinheiro/pix/boleto) | **na baixa** | `LancarPagamentoSchema.forma_pagamento` enum (`types.ts:89`) | (é da baixa, não do nascimento) | **não é gap** — corretamente em `MovimentoContasPagar` |
| **Plano de contas** | `Historico_tpg` → `dbo.Historico.ID_Hist` | sim | `trade_chart_of_accounts` (por `erp_code`; `connector-plano-contas.js`) | grava **`categoria_codigo`** (`code` de categoria, `:188`,`:417`) | `plano_contas_id`/`erp_code` (a conta real que vira `Historico_tpg`) fica **NULL**; grava code de categoria, não a conta real |

**Parcelamento — o gap mais duro (dois bloqueios somados):** o form manda `quantidade_parcelas`+`codigo_parcela` (`CadastroTituloAP.tsx:196-198`), mas `IncluirSchema.strict()` **não tem esses campos** (`types.ts:14-41`) → **400 sempre que o usuário parcela**. E mesmo se aceitasse, `handleIncluir` faz **1 INSERT só** (`crud-handlers.ts:444`), não explode em N linhas/N `Seq`. Sem `Seq`, não há PK de parcela no Result. Correção: (a) schema aceita os campos; (b) handler gera N linhas com `parcela`=1..N e vencimentos derivados; (c) mapear `parcela`→`Seq_tpg` no export.

**Ranking dos gaps por bloqueio ao write-back:**

| # | Gap | Severidade | Onde |
|---|---|---|---|
| **G1** | **Parcelamento quebrado** — `IncluirSchema.strict()` rejeita `quantidade_parcelas`/`codigo_parcela` (400 ao parcelar) + handler não explode em N `Seq` | 🔴 BLOQUEADOR DURO (sem `Seq` não há PK) | `types.ts:14-41` × `CadastroTituloAP.tsx:196-198`; `crud-handlers.ts:444` |
| **G2** | **`departamento_id` rejeitado no nascimento** — form envia (`:192`), schema `.strict()` não tem → 400; e verba não debita (§10.0-1) | 🔴 BLOQUEADOR DURO (bug ativo hoje) | `types.ts:14-41` × `CadastroTituloAP.tsx:192` |
| **G3** | **Plano de contas errado** — grava `categoria_codigo` (code de categoria), não `plano_contas_id`/`erp_code` = `Historico_tpg` real | 🔴 BLOQUEADOR DURO (sem `Historico_tpg` válido) | `crud-handlers.ts:417` × `:188`; `contas_pagar.plano_contas_id` fica NULL |
| **G4** | **`Tipo_tpg` nunca coletado** — não há campo Tipo na tela; PK do Result incompleta | 🔴 BLOQUEADOR DURO | `CadastroTituloAP.tsx` (ausente) |
| **G5** | **Chave-ponte inválida** — `codigo_lancamento_huggs` é `number` (`types.ts:10305`), §10.3 exige `uuid`, e `handleIncluir` não a gera → round-trip clona e debita verba 2× | 🟠 IDEMPOTÊNCIA (§10.0-4/§10.3) | `types.ts:10305`; `handleIncluir` |
| **G6** | **`natureza_lancamento` no default** — nascimento não seta; Result espera `Status_Tpg` (0=provisão) | 🟠 IDEMPOTÊNCIA/CLASSIFICAÇÃO | §10.2 propõe default `provisionado` |
| **G7** | **`Numero_Tpg` opcional** — título pode nascer sem número; PK depende de geração no Result | 🟡 OPERACIONAL | `CadastroTituloAP.tsx:194` |
| **G8** | **`portador` não preenchido** no nascimento (form não coleta; schema aceita opcional) | 🟡 OPERACIONAL | `CadastroTituloAP.tsx:220` (só listagem) |
| **G9** | **Vínculo de fornecedor frágil** — liga por `codigo_externo` validado só no app (sem FK); **duas tabelas** (`fornecedores` × `fabrica_fornecedores`) sem canônica p/ AP | 🟡 OPERACIONAL/INTEGRIDADE | `crud-handlers.ts:411`; `types.ts:25940`/`20207` |
| **G10** | **Sem gate de completude do fornecedor** — título nasce mesmo que o fornecedor não tenha CNPJ/banco que o Result exige | 🟡 OPERACIONAL | (ausente no fluxo) |
| **G11** | **Anexos do FPQ se perdem** — `contas_pagar` não tem coluna de anexos; PDFs de cotação/documento morrem no FPQ | 🟡 DOCUMENTAL (§10.0-2) | `contas_pagar` (`types.ts:10282`, sem `anexos`) |

**NÃO é gap (já correto):** `Valor`/`Saldo`, `Vencimento` (obrigatório), `Emissao`, `id_conta_corrente`, `Forma_Mtpg` (corretamente na baixa via `LancarPagamentoSchema.forma_pagamento`).

**Correções estruturais necessárias (o que "vira profissional"):**
1. **Fornecedor vira FK real:** adicionar `contas_pagar.fornecedor_id uuid REFERENCES fornecedores(id)`; definir `fornecedores` como **canônica para AP** (deprecar `fabrica_fornecedores` para AP, ou mapear); gate de completude (CNPJ + banco) no ato da seleção.
2. **Parcela modelada como Seq:** schema + handler geram N linhas (`parcela` 1..N); export mapeia `parcela`→`Seq_tpg`.
3. **Forma de pagamento:** portador coletado no nascimento (`portador_id`→`portador_codigo_erp`→`Portador_tpg`); forma continua na baixa.
4. **Plano de contas real:** gravar `plano_contas_id`/`erp_code` (a conta de `trade_chart_of_accounts`, = `Historico_tpg`), **não** `source_type+source_code` nem `categoria_codigo` de categoria.
5. **Chave-ponte:** `codigo_lancamento_huggs` para `uuid`, gerado no nascimento (§10.3).
6. **`Tipo_tpg`/`natureza`:** campo Tipo na tela; `natureza='provisionado'` default.

### 11.5 Impacto nas fases (F0–F4 do doc-mãe)

Ordenado por desbloqueio. A generalização da alçada e o contrato de dados são **pré-requisitos estruturais** (entram cedo, são inócuos sem tráfego); o empenho é F2/F3; o envio real fica em F4 atrás da API Result.

| Fase | Adição desta seção | Depende de |
|---|---|---|
| **F1 (Estrutura + distribuição)** | **Contrato de dados — parte estrutural (G1–G4):** `IncluirSchema`/`UpsertSchema` aceitam `departamento_id`, `plano_contas_id`, `quantidade_parcelas`/`codigo_parcela`, `Tipo`, `natureza` (fim do `.strict()` que rejeita hoje); `handleIncluir` explode parcelas em N `Seq`; `contas_pagar.fornecedor_id` FK + gate de completude. **É pré-requisito de QUALQUER título profissional** — sem isso o nascimento nem passa. Casa com os itens 1–3 da §3.4 e §10.2. | §3.4, §10.2 |
| **F1/F2 (Generalização da alçada)** | Promover `trade_approval_levels`/`trade_user_approval_levels` → `approval_levels` por departamento; portar `TradeAdminApprovalLevels` → `AdminApprovalLevels`; **fechar o gap de enforcement** (validação valor > `max_approval_amount` no ato, molde `check_campaign_expense_limit`); substituir a alçada pobre de `useManagerPendingExpenses`. Trade permanece intacto (aditivo). | espinha FPQ (já pronta) |
| **F2 (Débito + saldos)** | **Empenho:** criar `budget_commitments` polimórfico (molde `trade_budget_reserves`); `fn_orcamento_saldos` ganha a 3ª parcela de `comprometido_interno` (empenho `active` sem `contas_pagar_id`) com dedup `budget_commitments.contas_pagar_id → contas_pagar.id`. `budget_distributions.valor_comprometido` deixa de ser `0` hard-coded (`20260625144549:238`). | F1 do empenho + §3.2 |
| **F3 (Alertas + bloqueio)** | Gate de empenho valida saldo ANTES de aprovar a requisição (trigger BEFORE molde `validate_budget_reserve`/`check_campaign_expense_limit`); estorno automático em `released`/`cancelled`. Alçada por valor liga ao degrau de bloqueio (§3.5). | F2 do empenho |
| **F4 (Rolling + profundidade) — atrás da API Result** | **Requisição/cotação** (`expense_requests` + `expense_request_quotes`, N PDFs) — bloco greenfield, entrega o P2P completo. **Envio real ao Result:** parcelas→`Seq`, `fornecedor_id`→`ID_for`+CNPJ, `plano_contas_id`→`Historico_tpg`, portador→`Portador_tpg`, chave-ponte (§10.3); `erp-export-payment`/`erp-webhook-inbound`. **Anexo no título** (G11): resolver `contas_pagar` sem coluna de anexos. | F2/F3 + API Result |

**Ordem de segurança:** o **contrato de dados estrutural (F1)** e a **generalização da alçada (F1/F2)** são inócuos sem tráfego de write-back — instalam-se cedo. O **empenho (F2)** é o coração do "controle antes do lançamento" e não depende do Result. A **requisição/cotação e o envio real (F4)** só acendem com a API Result — mas quando acenderem, o título já nasce completo e a idempotência (§10) já está testada a seco.

### 11.6 Riscos e decisões em aberto (específicos desta seção)

| # | Risco / Decisão | Recomendação |
|---|---|---|
| **R1** | **Migração do Trade — não quebrar o que roda.** O Trade tem `trade_budgets`+`trade_budget_reserves` funcionando; a generalização cria `budget_commitments`+`approval_levels` genéricos. Migrar o Trade para o motor novo de uma vez arrisca parar campanhas ativas. | **Coexistência aditiva:** motor genérico nasce para os departamentos NÃO-Trade; Trade continua no seu caminho. `fn_orcamento_saldos` lê **ambos** (`trade_budget_reserves` E `budget_commitments`) durante a transição, com dedup por `contas_pagar_id` para não contar em dobro. Migrar o Trade para `budget_commitments` só depois de F3 estável, num passo explícito e reversível. |
| **R2** | **Empenho hard-reserve vs soft-reserve.** Hard = `validate_budget_reserve` **bloqueia** aprovação se `available < empenho` (não deixa empenhar sem saldo). Soft = permite empenhar acima, só sinaliza estouro. | **Hard-reserve nos gates internos** (coerente §3.5: "bloqueável = só os 2 gates internos") — o empenho é o momento certo de barrar, porque o fato ainda não ocorreu. Válvula: suplementação/remanejamento formal com trilha (D5, §8), nunca override por despesa. Folha/tributo/fornecedor crítico continuam pelo caminho direto no ERP (não passam por empenho). |
| **R3** | **Verba de campanha como sub-verba de departamento — modelagem.** (A) dar `department_id`/`distribution_id` à campanha e o empenho de campanha rola para cima no teto do depto; (B) `budget_commitment` polimórfico resolve o rollup sem tocar `trade_campaigns`. | **Opção B (commitment polimórfico)** — menos invasiva ao Trade vivo: o commitment aponta para `campaign_id` OU `distribution_id`, e a agregação da `fn_orcamento_saldos` faz o rollup campanha→depto lendo o `distribution_id` dono da campanha. Evita `ALTER` em `trade_campaigns` e o risco R1. Adicionar `trade_campaigns.distribution_id` só como referência de rollup (nullable), não como FK obrigatória. |
| **R4** | **Fornecedor canônico para AP — `fornecedores` × `fabrica_fornecedores`.** Duas tabelas de fornecedor; o título nativo referencia `fornecedores` (`crud-handlers.ts:411`), mas o usuário pode cadastrar no lugar errado; sem FK real hoje (`codigo_externo` validado só no app). | **`fornecedores` é a canônica para AP.** Adicionar `contas_pagar.fornecedor_id uuid FK` (fim do vínculo por texto); gate de completude (CNPJ NOT NULL já existe em `fornecedores`, mas exigir banco/PIX conforme forma). `fabrica_fornecedores` fica restrita ao domínio fábrica ou mapeada por `cnpj` — decidir via prompt Lovable se há fornecedores só em `fabrica_fornecedores` que precisam virar AP. |
| **R5** | **Requisição/cotação greenfield vs reaproveitar `department_expenses`.** Criar `expense_requests`/`expense_request_quotes` novo, ou estender `department_expenses` (que já tem anexos e caminho até FPQ)? | **Tabela nova `expense_requests` + `expense_request_quotes`** — a requisição é conceitualmente ANTES da despesa (N cotações, escolhe 1), com cardinalidade N:1 que `department_expenses` (fato único) não modela. Herda `attachments jsonb` + bucket privado. A cotação escolhida **gera** o `department_expense`/empenho; não substitui. Confirmar que nada em `budget_request` foi implementado (grep confirmou 0) antes de nomear. |
