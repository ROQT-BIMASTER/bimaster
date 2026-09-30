# Plano — Controle de Créditos e Débitos de Clientes · Filial Pernambuco

> Aplicação apartada, hospedada na VPS da empresa, com front-end próprio e conexão
> somente com banco de dados. Lê o ERP Result (filial Pernambuco) e mantém um livro
> de créditos e débitos por cliente, compartilhado em tempo real entre o cliente
> (pagador) e o financeiro (recebedor). Elaborado em 2026-09-30.

---

## 0. Resumo executivo

| Item | Definição |
|---|---|
| Problema | Clientes da filial PE pagam pedidos antecipadamente; na expedição, itens em ruptura não são enviados e o valor pago a maior vira crédito interno que hoje não tem controle sistematizado nem visibilidade para o cliente. |
| Solução | Aplicação independente ("Conta Corrente do Cliente PE") com livro-razão por cliente, alimentado automaticamente a partir do Result (pedidos, faturamento, pagamentos) e ajustado pelo financeiro, com extrato em tempo real para cliente e financeiro. |
| Fonte de dados | ERP Result (RESULT-PRO / Alltomatize), SQL Server, base `Ruby_SP`, empresa **8 = Union Pernambuco** (CNPJ 55.715.202/0001-01). Acesso somente leitura, pelo mesmo caminho de rede do conector que roda no droplet (Digital Ocean). |
| Hospedagem | VPS da empresa, Docker Compose (web, API, worker de sincronização, Postgres próprio, proxy TLS). Sem dependência do Lovable Cloud nem do bimaster. |
| Esforço | 8 semanas de construção + 2 de homologação e carga de saldo inicial (1 dev full-stack, 1 key-user do financeiro, apoio pontual do suporte Result). |
| Primeiro valor entregue | Fim da semana 4: financeiro já vê saldo por cliente PE calculado a partir do Result e registra ajustes com trilha de auditoria. |

---

## 1. O que já existe (diagnóstico no repositório bimaster)

O bimaster já integra o Result por três caminhos. O plano reaproveita o conhecimento, não o código.

| Caminho | Como funciona | Referência |
|---|---|---|
| Conector externo `connector-rubysp` (droplet) | Loop de 30 min lê o SQL Server e empurra lotes para funções `receber-*-rubysp` com token Bearer. Código do conector **não está neste repositório**. | `docs/ARQUITETURA-TORRE-CONTROLE-DESPESAS.md` §8, `supabase/functions/receber-pedidos-rubysp/index.ts` |
| Leitura direta SQL Server (`tedious`) | Env `ERP_SQL_HOST/USER/PASSWORD/DATABASE/PORT`, `encrypt: false` (rede interna via DDNS), `READ UNCOMMITTED` a pedido do time Result, login `db_datareader`. | `supabase/functions/_shared/erp-mssql.ts`, `supabase/functions/erp-sync-engine/index.ts:24-63` |
| API REST Atrio (Alltomatize) | OAuth2 client credentials, `GET /contas-receber?empresa=N` (empresas 1 a 11); escrita só em contas a pagar. | `supabase/functions/_shared/atrio-auth.ts`, `erp-sync-engine/index.ts:774-865` |

Objetos do Result já conhecidos e úteis para este projeto:

| Objeto no Result | Conteúdo | Uso aqui |
|---|---|---|
| `Cust_ClientesSP` (view) | Cadastro de clientes com `codigo_erp`, CNPJ, UF, vendedor, `limite_credito`, `status_bloqueio` | Base de clientes (filtrar filial PE) |
| Pedidos de venda + itens (origem do `erp_pedidos_rubysp` / `erp_pedido_itens_rubysp`) | Cabeçalho com `empresa_id`, `cliente_id`, `total_pedido`, `nf_numero`, etapas (liberação, separação, conferência, expedição, faturamento, entrega); itens com `quantidade`, `preco`, `desconto`, `total_item` | Pedido pago x pedido faturado; base para ruptura |
| `ConsultaPowerBIReceber` (view) | Títulos a receber: `Tipo`, `Nota`, `Seq`, `Código` (cliente), `Valor_Trc`, `Valor Pago`, `Valor em Aberto`, `Data Pgto` | Recebimentos e antecipações |
| `dbo.MovimentoConta` (origem do `erp_pagamentos_rubysp`) | Movimentos de caixa com `tipo_mov` entrada/saída, `documento`, **`pedido`** | Pagamento antecipado vinculado ao pedido |
| NF de saída e itens (nomes a confirmar; `erp_faturamento_rubysp` e `contas_receber.chave_nfe` provam que a informação existe) | Quantidade faturada por item | Cálculo da ruptura (pedido − faturado) |
| Orçamentos de venda (nome a confirmar; `erp_pedidos_rubysp.pedido_venda_relacionado` sugere encadeamento orçamento → pedido) | Proposta, validade, itens, pedido gerado | Crédito previsto e histórico comercial do cliente |

Restrições já acordadas com o time Result e que este projeto herda:

- Login somente leitura; nada é escrito no Result.
- Consultas pesadas fora do horário comercial; consultas leves e incrementais precisam de acordo explícito (ver §11).
- `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED` no início de cada sessão.

O que o bimaster já tem, e o que não tem, sobre este tema:

| Existe | Não existe |
|---|---|
| `clientes_perfil_credito` com limite, limite utilizado e score, recalculado por trigger a partir de `contas_receber` | Livro de créditos e débitos do cliente (adiantamento, haver, crédito interno) |
| `contas_receber` espelhado do Result com vínculos `n_cod_pedido`, `numero_pedido` e `chave_nfe` (prova que título, pedido e NF se ligam no ERP) | Quantidade pedida x faturada x cortada por item (ruptura só aparece como previsão de falta de estoque) |
| Portal Cliente (`/portal`) com login por papel `cliente` ligado ao CNPJ via `user_cnpj`, mostrando só tabela de preços e perfil | Extrato, pedidos ou saldo no portal |
| `orcamentos_caixa` (orçamento de caixa, planejado x realizado) | Orçamento/cotação de venda para o cliente |

Conclusão: o controle de crédito é um módulo novo; nada precisa ser migrado, e o app pode nascer apartado sem quebrar nada no bimaster.

---

## 2. Escopo e premissas

**Dentro do escopo (v1)**

1. Clientes da empresa 8 (Union PE), ativos e inativos com saldo diferente de zero.
2. Livro-razão de créditos e débitos por cliente, imutável (append-only), com saldo calculado.
3. Geração automática de lançamentos a partir do Result: pagamento antecipado, faturamento, ruptura, devolução.
4. Lançamentos manuais do financeiro (ajuste, uso de crédito em novo pedido, estorno) com aprovação em duas mãos acima de um limite.
5. Extrato e saldo em tempo real para o financeiro (visão de carteira) e para o cliente (visão própria), com notificação de cada novo lançamento.
6. Contestação pelo cliente e resposta do financeiro, com histórico.
7. Conciliação diária: saldo do livro x recebido no Result x faturado no Result, com relatório de divergências.
8. Exportação (CSV/PDF) do extrato e do fechamento mensal.

**Fora do escopo (v1)**

- Escrever qualquer coisa no Result (o crédito não vira título nem desconto automático no ERP).
- Outras filiais (o modelo nasce multi-filial, mas só a 8 é ativada).
- Emissão de boleto, pix ou cobrança. O app registra, não cobra.
- Integração com o bimaster. Prevista como fase opcional (§10, fase 5).

**Premissas**

- A VPS de destino é o próprio droplet onde o conector roda, ou tem rota de rede para o SQL Server pelo mesmo DDNS interno. Se não tiver, ver alternativa em §4.3.
- O time Result libera um segundo login `db_datareader` exclusivo para este app e aceita consultas incrementais leves a cada 5 min na empresa 8.
- O financeiro fornece a planilha de créditos existentes hoje por cliente, para carga do saldo inicial.

---

## 3. Regras de negócio do crédito

### 3.1 Eventos e lançamentos

| Evento no mundo real | Lançamento gerado | Origem | Valor |
|---|---|---|---|
| Cliente paga antes do faturamento | `CREDITO_ANTECIPACAO` | Automático (MovimentoConta entrada com pedido, ou título recebido sem NF) | Valor recebido |
| Pedido é faturado (NF emitida) | `DEBITO_FATURAMENTO` | Automático (NF de saída) | Valor líquido da NF |
| Item do pedido não enviado (ruptura) | `CREDITO_RUPTURA` | Automático (qtd pedida − qtd faturada) × preço líquido do item | Diferença |
| Devolução aceita | `CREDITO_DEVOLUCAO` | Automático (NF de devolução) ou manual | Valor devolvido |
| Cliente usa crédito num novo pedido | `DEBITO_UTILIZACAO` | Manual pelo financeiro, referenciando o pedido | Valor abatido |
| Correção de erro | `CREDITO_AJUSTE` / `DEBITO_AJUSTE` | Manual, com justificativa obrigatória | Livre |
| Cancelamento de lançamento | `ESTORNO` | Manual; gera contrapartida com sinal inverso e vincula ao original | Igual ao original |
| Carga inicial | `CREDITO_SALDO_INICIAL` | Importação única, com evidência anexada | Planilha do financeiro |

Regras:

1. **Nunca se edita ou apaga um lançamento.** Correção é sempre estorno + novo lançamento.
2. **Saldo do cliente = soma dos lançamentos com status `confirmado`.** Crédito positivo, débito negativo. Saldo negativo é permitido e sinaliza "cliente deve" (por exemplo, faturou mais do que pagou).
3. **Idempotência**: cada lançamento automático carrega `origem_tipo + origem_chave` (ex.: `nf:8-12345`, `mov:8-9987`, `ruptura:8-pedido-77-item-3`) com restrição de unicidade. Reprocessar o Result nunca duplica.
4. **Ruptura só é calculada depois do faturamento** da NF ligada ao pedido, e apenas uma vez por par pedido/NF. Se o pedido gerar mais de uma NF (faturamento parcial), a ruptura é calculada sobre o acumulado faturado.
5. **Lançamentos manuais acima de R$ 5.000,00** (parâmetro) ficam `pendente_aprovacao` até um segundo usuário do financeiro aprovar (regra de quatro olhos). O aprovador não pode ser quem criou.
6. **Contestação**: o cliente pode contestar qualquer lançamento em até 30 dias (parâmetro). A contestação não altera saldo; abre um chamado que o financeiro resolve com estorno, ajuste ou indeferimento. Tudo fica no histórico do lançamento.
7. **Moeda**: BRL com duas casas, arredondamento bancário no cálculo de ruptura (qtd × preço − desconto proporcional).
8. **Datas**: fuso `America/Sao_Paulo`; datas do Result são tratadas como data local, nunca convertidas via UTC.

### 3.2 Estados de um lançamento

```
rascunho → pendente_aprovacao → confirmado → estornado
                  └──────────→ rejeitado
```

Automáticos nascem `confirmado`. Manuais nascem `pendente_aprovacao` se acima do limite, senão `confirmado`.

### 3.3 Onde a ruptura é identificada

Sequência esperada no Result para um pedido da empresa 8:

```
Pedido digitado ─▶ liberação ─▶ separação ─▶ conferência ─▶ expedição ─▶ NF ─▶ entrega
       │                                                                   │
  pagamento antecipado (MovimentoConta / título)                 itens da NF (qtd faturada)
```

Ruptura por item = `quantidade_pedida − quantidade_faturada` quando `> 0` e o pedido está em etapa `faturamento` ou posterior. Se o Result gravar o motivo do corte (campo a confirmar na descoberta, §6.1), o motivo é copiado para o lançamento.

---

## 4. Arquitetura

### 4.1 Visão geral

```
                         VPS (Docker Compose)
 ┌────────────────────────────────────────────────────────────────┐
 │  caddy (TLS, reverse proxy)                                    │
 │    ├── /            → web  (React + Vite, SPA estático)        │
 │    ├── /api         → api  (Node 22 + Fastify + Drizzle)       │
 │    └── /realtime    → api  (Socket.IO)                         │
 │                                                                │
 │  worker (Node 22)  ── sync incremental 5 min ──┐               │
 │     ├── clientes PE                            │  SQL read-only│
 │     ├── pedidos + itens PE                     ├──────────────────▶ Result / Ruby_SP
 │     ├── NFs + itens PE                         │  (SQL Server, │    (SQL Server)
 │     ├── movimentos de caixa PE                 │   empresa 8)  │
 │     └── motor de regras → lançamentos          │               │
 │                                                                │
 │  postgres 16 (banco próprio: espelho + livro-razão + usuários) │
 │     └── LISTEN/NOTIFY ──▶ api ──▶ Socket.IO ──▶ navegadores    │
 └────────────────────────────────────────────────────────────────┘
```

Três processos de aplicação, um banco, um proxy. Nada de fila externa: o agendamento usa `pg-boss` sobre o próprio Postgres, e o tempo real usa `LISTEN/NOTIFY` do Postgres para acordar o Socket.IO.

### 4.2 Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | TypeScript ponta a ponta, Node 22 LTS | Mesma linguagem do bimaster e do conector; um dev cobre tudo |
| API | Fastify 5 + Zod (`.strict()`) | Leve, tipada, validação igual à do bimaster |
| Acesso ao Postgres | Drizzle ORM + migrations versionadas | Schema em código, migrations revisáveis em PR |
| Acesso ao Result | `mssql` (tedious) com pool pequeno (2 conexões), `READ UNCOMMITTED`, timeouts curtos | Mesmo driver já validado no `erp-mssql.ts` |
| Jobs | `pg-boss` | Retry, cron e lock sem Redis |
| Tempo real | Socket.IO com salas por cliente e por perfil | Reconexão automática, fallback long-polling |
| Front-end | React 18 + Vite + Tailwind + shadcn/ui + TanStack Query | Reaproveita tokens HSL e componentes do bimaster (copiados, não importados) |
| Auth | Sessão em cookie `HttpOnly` + senha (argon2) + TOTP obrigatório para o financeiro | Sem dependência externa; cliente entra com CNPJ + senha, financeiro com e-mail + senha + TOTP |
| Proxy/TLS | Caddy | Certificado automático, HSTS, headers de segurança |
| Observabilidade | `pino` em JSON, `/healthz`, métricas de sync em tabela | Suficiente para uma VPS; exportável depois |
| Backup | `pg_dump` diário para Spaces/S3 com retenção 30 dias | O livro-razão é o ativo do sistema |

### 4.3 Rede com o Result

Ordem de preferência:

1. **App na mesma VPS do conector (droplet).** Usa o mesmo DDNS interno e porta 1433 que o conector já usa; só precisa de um login novo.
2. **VPS diferente, com túnel WireGuard até o droplet.** O droplet vira gateway; regra de firewall libera só a porta 1433 para o IP do túnel.
3. **Sem rota possível até o SQL Server.** O `connector-rubysp` ganha um destino a mais (POST para `/api/ingest/*` deste app, com token próprio), no mesmo padrão dos `receber-*-rubysp`. Custa uma alteração no conector e adiciona latência de até um ciclo do loop.

Recomendação: opção 1. A opção 3 fica documentada como plano B.

---

## 5. Modelo de dados (Postgres próprio)

### 5.1 Espelho do Result (somente leitura pela aplicação, escrito só pelo worker)

| Tabela | Chave | Colunas principais |
|---|---|---|
| `erp_clientes` | `(empresa_id, codigo_erp)` | cnpj, razao_social, nome_fantasia, uf, cidade, vendedor, limite_credito, status_bloqueio, inativo, `raw jsonb`, `sincronizado_em` |
| `erp_pedidos` | `(empresa_id, pedido_id)` | cliente codigo, data_pedido, status, etapa, total_pedido, cond_pagamento, nf_numero, ts_faturamento, motivo_cancelamento, `raw` |
| `erp_pedido_itens` | `(empresa_id, pedido_id, sequencia)` | produto_id, descricao, ean, quantidade, preco, desconto, total_item |
| `erp_notas` | `(empresa_id, nf_numero, serie)` | pedido_id, cliente codigo, data_emissao, valor_produtos, valor_liquido, tipo (saída/devolução), cancelada |
| `erp_nota_itens` | `(empresa_id, nf_numero, serie, sequencia)` | produto_id, quantidade, preco, total |
| `erp_movimentos` | `(empresa_id, erp_id)` | data, valor, tipo_mov, documento, pedido, conta, historico |
| `erp_titulos` | `(empresa_id, tipo, nota, seq, cliente)` | valor_original, valor_pago, valor_aberto, emissão, vencimento, data_pgto, pedido, chave_nfe |
| `erp_orcamentos` + `erp_orcamento_itens` | `(empresa_id, orcamento_id[, sequencia])` | cliente, data, validade, situação, pedido gerado, itens (qtd, preço) — só se a descoberta confirmar a fonte |
| `sync_runs` | id | entidade, iniciado_em, terminado_em, linhas_lidas, linhas_gravadas, erro |

Todas com `empresa_id` para o modelo ser multi-filial desde o início.

### 5.2 Domínio do app

| Tabela | Descrição |
|---|---|
| `clientes` | Um por `(empresa_id, codigo_erp)`; liga o espelho a usuários do portal, e-mail de notificação, flags (bloqueado para uso de crédito, observações) |
| `lancamentos` | **Append-only.** `id`, `cliente_id`, `tipo` (enum §3.1), `valor` (numeric 14,2, sinal pelo tipo), `status`, `origem_tipo`, `origem_chave` (unique), `pedido_id`, `nf_numero`, `item_sequencia`, `descricao`, `justificativa`, `criado_por`, `aprovado_por`, `estorna_lancamento_id`, `criado_em`, `confirmado_em` |
| `saldos_cliente` (view materializada, refresh por trigger) | `cliente_id`, `saldo`, `creditos_pendentes`, `ultimo_lancamento_em` |
| `contestacoes` | `lancamento_id`, aberto_por, motivo, status (aberta / respondida / encerrada), resolucao, `lancamento_resolucao_id` |
| `contestacao_mensagens` | thread entre cliente e financeiro |
| `anexos` | comprovantes (armazenados em disco da VPS com path por cliente; limite 20 MB; validação de tipo por magic bytes) |
| `usuarios` | e-mail, hash de senha, perfil (`financeiro`, `financeiro_aprovador`, `admin`, `cliente`), `cliente_id` quando perfil cliente, TOTP secret, ativo |
| `sessoes` | sessão server-side com expiração e revogação |
| `parametros` | limite de aprovação dupla, prazo de contestação, cadência de sync, empresas ativas |
| `audit_log` | quem, quando, o quê, antes/depois, IP; hash encadeado (mesma ideia do `audit_log_immutable` do bimaster) |
| `notificacoes` | fila de e-mail/WhatsApp por lançamento, com status de envio |

Regras no banco, não só na aplicação: `lancamentos` sem permissão de UPDATE/DELETE para o papel da API (apenas INSERT e update de `status`/`aprovado_por` via função); `origem_chave` unique; trigger que recusa `confirmado` sem `aprovado_por` quando `valor > parametro`.

---

## 6. Integração com o Result

### 6.1 Descoberta (semana 1, com o suporte Result)

Consultas de leitura para fechar os nomes reais das tabelas de NF e itens, o vínculo pedido→NF e o campo de motivo de corte:

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
 WHERE TABLE_NAME LIKE '%Nota%' OR TABLE_NAME LIKE '%NF%' OR TABLE_NAME LIKE '%Pedido%'
    OR TABLE_NAME LIKE '%Item%' OR TABLE_NAME LIKE '%Movimento%' OR TABLE_NAME LIKE '%Receber%'
 ORDER BY TABLE_NAME;

SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '<tabela>';

-- Amostra da filial PE
SELECT TOP 20 * FROM ConsultaPowerBIReceber WHERE [ID Empresa] = 8 ORDER BY [Emissão] DESC;
```

A descoberta também procura a tabela de orçamentos de venda (quotes) e o encadeamento orçamento → pedido → NF → título, para que o extrato do cliente mostre a cadeia completa e o "crédito previsto" de pedidos pagos ainda não faturados.

Entregável da descoberta: um documento `docs/result-schema-pe.md` com, para cada entidade, a query final, a chave, a coluna de "atualizado em" (ou a estratégia de janela por data) e o volume médio diário na empresa 8.

### 6.2 Sincronização

| Entidade | Cadência | Estratégia incremental | Volume esperado (empresa 8) |
|---|---|---|---|
| Clientes | 1 h | Full da view filtrada por filial (pequeno) | centenas |
| Pedidos + itens | 5 min | Janela: `data_pedido >= hoje − 7 dias` ou etapa alterada; reprocessa os últimos 7 dias sempre | dezenas/dia |
| NFs + itens | 5 min | Janela por `data_emissao` (últimos 7 dias) | dezenas/dia |
| Movimentos de caixa | 5 min | Janela por `data_movimento` (últimos 7 dias) | dezenas/dia |
| Títulos a receber | 15 min | Janela por emissão/pagamento (últimos 30 dias) | centenas |
| Reconciliação completa | diária 05:30 (janela já acordada com o Result) | Full da empresa 8 nos últimos 90 dias, detecta o que o incremental perdeu | — |

Todo ciclo grava em `sync_runs`; três falhas seguidas disparam alerta ao admin e a tela mostra "dados atualizados há X min" em destaque.

### 6.3 Motor de regras (roda após cada sync)

1. Para cada movimento de entrada novo com `pedido` preenchido e pedido ainda não faturado → `CREDITO_ANTECIPACAO`.
2. Para cada título novo com `Valor Pago > 0` e sem NF vinculada → `CREDITO_ANTECIPACAO` (dedupe com o item 1 pela chave documento/pedido).
3. Para cada NF de saída nova, não cancelada → `DEBITO_FATURAMENTO`.
4. Para cada NF de saída nova ligada a pedido: comparar itens → `CREDITO_RUPTURA` por item com diferença positiva.
5. Para cada NF de devolução nova → `CREDITO_DEVOLUCAO`.
6. NF cancelada depois de lançada → `ESTORNO` automático do débito e das rupturas dela, com aviso ao financeiro.

O motor é uma função pura sobre o espelho, testável com fixtures. Cada regra tem teste de unidade com um cenário real anonimizado da empresa 8.

---

## 7. Tempo real e compartilhamento pagador / recebedor

- Cada `INSERT` em `lancamentos` ou `contestacoes` dispara `NOTIFY lancamento_evento` com o `cliente_id`.
- A API escuta o canal e emite para as salas Socket.IO: `cliente:<id>` (portal do cliente) e `financeiro` (carteira inteira).
- O front atualiza saldo e extrato sem recarregar, com destaque visual do lançamento novo.
- Notificação assíncrona (worker): e-mail transacional para o cliente a cada lançamento confirmado e resumo diário para o financeiro. WhatsApp fica opcional (fase 4), via provedor já usado pela empresa.
- Se o cliente estiver offline, o próximo login mostra "novidades desde a última visita".

Latência esperada do fato no Result até a tela: até 5 min (cadência do sync) + segundos. Se o time Result autorizar cadência de 1 min na empresa 8, cai para cerca de 1 min.

---

## 8. Perfis, telas e fluxos

### 8.1 Perfis

| Perfil | Vê | Faz |
|---|---|---|
| `cliente` | Só o próprio saldo, extrato, pedidos, NFs relacionadas e contestações | Contesta lançamento, anexa comprovante, exporta extrato |
| `financeiro` | Todos os clientes da filial | Cria lançamento manual, responde contestação, registra uso de crédito |
| `financeiro_aprovador` | Idem | Aprova lançamentos acima do limite (não os próprios) |
| `admin` | Tudo + parâmetros, usuários, sync | Gerencia usuários e parâmetros, dispara sync manual |

### 8.2 Telas

**Financeiro**

1. **Carteira PE** — tabela de clientes com saldo, créditos pendentes, último lançamento, contestações abertas; filtros por vendedor, faixa de saldo, situação. KPIs no topo: total de crédito em aberto, total de débito, rupturas do mês, pendentes de aprovação.
2. **Cliente** — cabeçalho (dados do ERP), saldo grande, timeline do extrato com origem clicável (abre pedido/NF espelhados), aba de contestações, aba de pedidos com status de faturamento e rupturas calculadas.
3. **Novo lançamento** — formulário com tipo, valor, vínculo opcional a pedido/NF, justificativa obrigatória, anexo; mostra saldo antes/depois.
4. **Aprovações** — fila de pendentes com diff e botão aprovar/rejeitar.
5. **Conciliação** — por dia: soma recebida no Result × créditos gerados; soma faturada × débitos; divergências listadas.
6. **Sincronização** — status por entidade, última execução, erros, botão "sincronizar agora".

**Cliente (portal)**

1. **Meu saldo** — saldo atual, próximos créditos previstos (pedidos pagos ainda não faturados), últimos lançamentos.
2. **Extrato** — filtro por período e tipo, exportação CSV/PDF.
3. **Meus pedidos** — orçamento de origem (quando houver), pedido, valor, etapa no Result, NF, itens não enviados com valor creditado.
4. **Contestações** — abrir, acompanhar, anexar.

### 8.3 Fluxos-chave

- **Pagamento antecipado → crédito**: sync detecta entrada com pedido → lançamento confirmado → notify → cliente e financeiro veem em tempo real → e-mail ao cliente.
- **Faturamento com ruptura**: sync detecta NF → débito da NF + créditos de ruptura por item → cliente vê "3 itens não enviados: R$ X creditado".
- **Uso do crédito**: vendedor fecha novo pedido; financeiro registra `DEBITO_UTILIZACAO` vinculando ao pedido (se acima do limite, aprovador confirma) → cliente vê o abatimento.
- **Contestação**: cliente contesta → financeiro responde com estorno/ajuste ou indefere → histórico preservado.

---

## 9. Segurança e conformidade

- Login do Result exclusivo, `db_datareader`, restrito por firewall ao IP da VPS; credenciais em `.env` fora do repositório, com rotação semestral.
- Postgres não exposto na internet (só na rede Docker). Backups cifrados.
- Senhas com argon2id; TOTP obrigatório para perfis do financeiro; bloqueio após 5 tentativas; sessão de 8 h para financeiro e 24 h para cliente.
- Autorização no servidor em toda rota: cliente só acessa `cliente_id` da própria sessão. Testes automatizados de "cliente A tenta ler cliente B".
- Headers de segurança (CSP, HSTS, X-Frame-Options) no Caddy; rate limit por IP e por sessão na API.
- Upload: 20 MB, magic bytes, sem dupla extensão, path por cliente (mesmas regras do bimaster).
- LGPD: dados de cliente PJ com contato; minimização (não espelhar colunas desnecessárias do Result), log de acesso a dados de cliente, exclusão de usuário do portal a pedido.
- Auditoria imutável de todo lançamento, aprovação, contestação e mudança de parâmetro.
- Zod `.strict()` em todos os bodies; nenhuma query SQL montada por concatenação (parâmetros sempre).

---

## 10. Fases, entregas e cronograma

| Fase | Semanas | Entregas | Pronto quando |
|---|---|---|---|
| **0. Descoberta e acesso** | 1 | Login read-only, rota de rede validada da VPS, `docs/result-schema-pe.md`, planilha de saldo inicial recebida, parâmetros acordados (limite de aprovação, prazo de contestação, cadência) | `SELECT TOP 1` de cada entidade roda da VPS e as chaves estão fechadas |
| **1. Fundação e espelho** | 2 | Repositório, Docker Compose, Postgres com migrations, worker de sync das 6 entidades, tela de sincronização, auth do financeiro com TOTP | Espelho da empresa 8 completo e atualizando a cada 5 min há 3 dias sem erro |
| **2. Livro-razão e carteira** | 2 | Tabela `lancamentos`, motor de regras (6 regras) com testes, carga do saldo inicial, telas Carteira / Cliente / Novo lançamento / Aprovações, audit log | Financeiro confere 20 clientes contra a planilha e os saldos batem; rupturas do último mês reproduzidas |
| **3. Portal do cliente e tempo real** | 2 | Auth do cliente, telas Meu saldo / Extrato / Pedidos / Contestações, Socket.IO, e-mail transacional, exportações | Cliente piloto vê o crédito de uma ruptura real minutos depois do faturamento |
| **4. Conciliação, hardening e go-live** | 1 | Tela de conciliação, reconciliação diária, backups, alertas, testes de autorização, revisão de segurança, manual do financeiro | Uma semana de operação paralela sem divergência não explicada |
| **Homologação assistida** | 2 | Operação real com 5 a 10 clientes piloto, ajustes de regra | Financeiro aprova a abertura para todos os clientes PE |
| **5. (opcional) Integração bimaster** | 1 | API read-only `/api/v1/clientes/:codigo/saldo` com API key; card de saldo no `ClienteDetalheDialog` do bimaster | Saldo aparece no CRM |

Total: 8 semanas de construção + 2 de homologação. Marcos de valor: semana 3 (espelho vivo), semana 5 (saldo confiável para o financeiro), semana 7 (cliente enxerga), semana 8 (go-live).

Equipe: 1 dev full-stack em dedicação integral; key-user do financeiro (4 h/semana nas fases 0, 2 e homologação); contato do suporte Result (fase 0 e dúvidas pontuais); admin da VPS (fase 0 e 4).

---

## 11. Riscos e decisões pendentes

| # | Risco / decisão | Impacto | Mitigação / quem decide |
|---|---|---|---|
| 1 | Nome das tabelas de NF e itens no Result e vínculo pedido→NF | Bloqueia o cálculo de ruptura | Descoberta na fase 0 com o suporte Result; `erp_pedidos_rubysp.nf_numero` prova que o vínculo existe |
| 2 | Time Result só aceitar consultas fora do horário comercial | "Tempo real" vira "próximo dia" | Negociar cadência de 5 min só na empresa 8 com queries por índice de data; fallback: opção 3 do §4.3 reaproveitando o loop de 30 min do conector |
| 3 | Onde o pagamento antecipado aparece (MovimentoConta com `pedido`, título tipo adiantamento ou ambos) | Regra de antecipação errada gera crédito duplicado | Fase 0 valida com 10 casos reais; dedupe por documento |
| 4 | Faturamento parcial (um pedido, várias NFs) | Ruptura calculada cedo demais | Regra 4 usa acumulado; parâmetro "aguardar N dias após primeira NF" antes de fechar a ruptura |
| 5 | Saldo inicial sem lastro documental | Disputas com clientes | Carga exige anexo por cliente e assinatura do responsável do financeiro |
| 6 | O crédito não existe no Result; vendedor pode não aplicar o abatimento no pedido | Cliente com crédito paga de novo | Alerta ao financeiro quando um cliente com saldo positivo tem pedido novo pago integralmente; fase 5 leva o saldo ao CRM |
| 7 | VPS sem rota até o SQL Server | Arquitetura muda | Validar na fase 0 antes de qualquer código |
| 8 | Um único dev | Continuidade | Documentação viva no repositório, README de operação, PRs revisados |

Decisões que precisam de resposta do negócio antes da fase 2:

1. Limite para aprovação dupla (proposta: R$ 5.000,00).
2. Prazo para contestação (proposta: 30 dias).
3. Crédito expira? (proposta: não expira na v1; relatório de créditos parados há mais de 180 dias).
4. Cliente inativo no ERP com saldo: continua vendo o portal? (proposta: sim, somente leitura).
5. Vendedor da filial PE terá acesso de leitura à carteira dos seus clientes? (proposta: não na v1).

---

## 12. Infraestrutura e custos

| Item | Especificação | Custo estimado |
|---|---|---|
| VPS | 2 vCPU, 4 GB RAM, 80 GB SSD (droplet existente ou novo) | US$ 24/mês se novo |
| Backup off-site | DO Spaces ou S3, 30 dias | ~US$ 5/mês |
| E-mail transacional | Provedor SMTP (Resend, SES ou Postmark), até 10 mil/mês | US$ 0 a 20/mês |
| Domínio | `creditos.<dominio-da-empresa>.com.br` com certificado Caddy | já existente |
| Monitoramento | Uptime externo gratuito + alerta por e-mail | US$ 0 |

Volume da empresa 8 é pequeno (dezenas de pedidos por dia); a VPS mínima atende por anos. O Postgres cresce na ordem de poucos MB por mês.

---

## Apêndice A — Estrutura do repositório proposto

```
credito-clientes-pe/
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── apps/
│   ├── api/        Fastify + Socket.IO + Drizzle (rotas, auth, ledger, notify)
│   ├── worker/     sync Result → espelho, motor de regras, pg-boss jobs, e-mails
│   └── web/        React + Vite (financeiro e portal do cliente no mesmo app, rotas separadas)
├── packages/
│   ├── db/         schema Drizzle, migrations, seeds
│   ├── domain/     tipos, enums, motor de regras puro (100% testado)
│   └── ui/         tokens HSL e componentes shadcn copiados do bimaster
├── docs/
│   ├── result-schema-pe.md
│   ├── regras-de-credito.md
│   └── operacao.md (deploy, backup, restore, rotação de credenciais)
└── scripts/        backup.sh, restore.sh, carga-saldo-inicial.ts
```

## Apêndice B — Contrato mínimo da API

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/api/auth/login`, `/logout`, `/totp/verify` | todos | Sessão |
| GET | `/api/clientes?busca=&saldo=` | financeiro | Carteira |
| GET | `/api/clientes/:id` | financeiro, cliente (próprio) | Cabeçalho + saldo |
| GET | `/api/clientes/:id/lancamentos?de=&ate=&tipo=` | idem | Extrato paginado |
| POST | `/api/lancamentos` | financeiro | Lançamento manual |
| POST | `/api/lancamentos/:id/aprovar` \| `/rejeitar` \| `/estornar` | aprovador | Fluxo de aprovação |
| GET | `/api/clientes/:id/pedidos` | idem | Pedidos com NF e rupturas |
| POST | `/api/lancamentos/:id/contestacoes` | cliente | Abrir contestação |
| POST | `/api/contestacoes/:id/mensagens` | cliente, financeiro | Thread |
| GET | `/api/conciliacao?dia=` | financeiro | Divergências |
| GET | `/api/sync/status` · POST `/api/sync/run` | admin | Sincronização |
| WS | `/realtime` | todos | Eventos `lancamento.novo`, `contestacao.atualizada`, `sync.status` |
| GET | `/api/v1/clientes/:codigo/saldo` | API key (fase 5) | Integração externa |
