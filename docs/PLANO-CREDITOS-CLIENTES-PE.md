# Plano — Conta Corrente do Cliente PE (SaaS PHP na Digital Ocean)

> Aplicação PHP separada, hospedada na VPS da empresa na Digital Ocean, no mesmo
> molde da Torre de Pedidos do workspace (`vps.lumustech.online/ruby/workspace`):
> lê o ERP Result somente pelo banco de dados e mantém o livro de créditos e
> débitos de cada cliente da filial Pernambuco, visível em tempo real para o
> cliente (pagador) e para o financeiro (recebedor). Sem GitHub: código, deploy
> e backup vivem na própria VPS e na Digital Ocean. Revisão de 2026-09-30.

---

## 0. Resumo executivo

| Item | Definição |
|---|---|
| Problema | Clientes da filial PE pagam pedidos antecipadamente. Na expedição, itens em ruptura não são enviados e o valor pago a maior vira crédito interno sem controle sistematizado e sem visibilidade para o cliente. |
| Solução | SaaS próprio ("Conta Corrente do Cliente") com livro-razão por cliente, alimentado automaticamente pelo Result (pedidos, NFs, pagamentos) e ajustado pelo financeiro; extrato compartilhado em tempo real entre cliente e financeiro; Torre de Créditos no mesmo estilo da Torre de Pedidos. |
| Fonte de dados | ERP Result (RESULT-PRO / Alltomatize), SQL Server, base `Ruby_SP`, empresa **8 = Union Pernambuco** (CNPJ 55.715.202/0001-01). Acesso somente leitura pela mesma rota de rede que o conector já usa na VPS. |
| Stack | PHP 8.3 + Laravel 12, MySQL 8, Laravel Reverb (WebSocket), Inertia + Vue 3 + Tailwind, Nginx + PHP-FPM, Supervisor. Tudo na VPS Digital Ocean. |
| Separação | Aplicação, banco, domínio e usuários próprios. Não toca no workspace atual nem no bimaster. Multi-tenant desde o início (filial PE é o primeiro tenant). |
| Esforço | 8 semanas de construção + 2 de homologação (1 dev PHP, 1 key-user do financeiro, suporte Result pontual). |
| Primeiro valor | Fim da semana 5: financeiro vê o saldo de cada cliente PE calculado a partir do Result e registra ajustes com trilha de auditoria. |

---

## 1. O que já existe e o que este plano copia da Torre de Pedidos

### 1.1 Como o Result chega hoje

| Caminho | Como funciona | Onde está |
|---|---|---|
| Conector `connector-rubysp` (na VPS) | Loop de 30 min (Node) lê o SQL Server e empurra lotes para rotinas de recepção com token Bearer; painel pede sincronização sob demanda gravando uma solicitação que o conector consome (`pull`) e reporta (`done`). | `docs/ARQUITETURA-TORRE-CONTROLE-DESPESAS.md`, `supabase/functions/sync-control-rubysp/index.ts` |
| Leitura direta SQL Server | Driver TDS, rede interna via DDNS sem TLS, `READ UNCOMMITTED` a pedido do time Result, login `db_datareader`. | `supabase/functions/_shared/erp-mssql.ts` |
| API REST Atrio (Alltomatize) | OAuth2 client credentials; títulos a receber por empresa (1 a 11). | `supabase/functions/_shared/atrio-auth.ts` |

### 1.2 Padrão da Torre de Pedidos que será reproduzido

| Elemento da Torre | Como aparece hoje | Equivalente no novo SaaS |
|---|---|---|
| Kanban por etapa | Colunas Em digitação → Liberado (crédito) → Em separação → Conferido → Em expedição → Faturado → Entregue, com idade na etapa e alerta de "parado" | **Torre de Créditos**: colunas Pago antecipado (aguardando NF) → Faturado (conferindo ruptura) → Crédito disponível → Crédito compensado → Contestado, com dias na etapa e alerta de crédito parado |
| Filtros | Filial, etapa, busca, "apenas parados", ordenação, persistidos no navegador | Idem, com filtro por vendedor e faixa de saldo |
| KPIs no topo | Lead time porta-a-porta, p50 por etapa | Crédito em aberto, débito em aberto, rupturas do mês, pendentes de aprovação, tempo médio até compensação |
| Gaveta de detalhe do pedido | Emissão, previsão, vendedor, condição, timeline das etapas com usuário e horário, itens, posição financeira do cliente, canhoto | Gaveta do pedido com itens pedidos x faturados x cortados, lançamentos gerados, timeline financeira (pago → faturado → crédito → compensado) |
| Barra de sincronização | Ponto verde/amarelo/vermelho, "atualizado há X", botão "Atualizar agora" que grava uma solicitação para o conector | Idem, executada pelo worker PHP; botão grava solicitação em `sync_solicitacoes` |
| Histórico do cliente | Compras mensais e previsão | Extrato do cliente + saldo + créditos previstos |

### 1.3 Objetos do Result já conhecidos

| Objeto | Conteúdo | Uso |
|---|---|---|
| Cadastro de clientes (fonte do conector) | código, CNPJ, UF, vendedor, limite de crédito, bloqueio | Clientes da filial PE |
| Pedidos de venda + itens | empresa, cliente, total, condição, `nf_numero`, carimbos de cada etapa; itens com quantidade, preço, desconto | Pedido pago x faturado; base da ruptura |
| `ConsultaPowerBIReceber` (view) | tipo, nota, parcela, cliente, valor, pago, em aberto, data de pagamento | Recebimentos e antecipações |
| `dbo.MovimentoConta` | entrada/saída, documento, **pedido** | Pagamento antecipado ligado ao pedido |
| NF de saída e itens (nome a confirmar) | quantidade faturada por item | Cálculo da ruptura |
| Orçamentos de venda (nome a confirmar) | proposta, validade, pedido gerado | Cadeia orçamento → pedido → NF; crédito previsto |

O bimaster não tem livro de crédito nem quantidade pedida x faturada por item; o Portal Cliente atual mostra só tabela de preços. O módulo é novo e nasce apartado.

---

## 2. Escopo e premissas

**Dentro da versão 1**

1. Tenant "Union PE" (empresa 8) com seus clientes ativos e inativos com saldo.
2. Livro-razão de créditos e débitos por cliente, append-only, com saldo calculado.
3. Lançamentos automáticos a partir do Result: antecipação, faturamento, ruptura, devolução.
4. Lançamentos manuais do financeiro (ajuste, uso de crédito, estorno) com aprovação em duas mãos acima de um limite.
5. Torre de Créditos (Kanban) + carteira + extrato em tempo real para financeiro e cliente.
6. Contestação pelo cliente com resposta do financeiro.
7. Conciliação diária: livro x recebido x faturado no Result.
8. Exportação CSV/PDF do extrato e do fechamento mensal.

**Fora da versão 1**

- Escrever no Result. O crédito não vira título nem desconto automático no ERP.
- Outras filiais/empresas ativadas (o modelo multi-tenant já suporta, só não são ligadas).
- Boleto, pix ou cobrança.
- Integração com o bimaster ou com o workspace atual (fase opcional).

**Premissas**

- A VPS Digital Ocean que hospeda o workspace e o conector tem rota até o SQL Server do Result (o conector prova isso). O novo app roda na mesma VPS ou em um droplet novo na mesma VPC.
- O time Result libera um login `db_datareader` exclusivo para este app e aceita consultas incrementais leves a cada 5 min na empresa 8.
- O financeiro fornece a planilha dos créditos existentes hoje para a carga inicial.
- Nada é publicado no GitHub. Git existe só como repositório local na VPS (bare repo) para versionar e fazer deploy.

---

## 3. Regras de negócio do crédito

### 3.1 Eventos e lançamentos

| Evento | Lançamento | Origem | Valor |
|---|---|---|---|
| Cliente paga antes do faturamento | `CREDITO_ANTECIPACAO` | Automático (MovimentoConta entrada com pedido, ou título recebido sem NF) | Valor recebido |
| Pedido faturado | `DEBITO_FATURAMENTO` | Automático (NF de saída) | Valor líquido da NF |
| Item não enviado (ruptura) | `CREDITO_RUPTURA` | Automático (qtd pedida − qtd faturada) × preço líquido | Diferença |
| Devolução aceita | `CREDITO_DEVOLUCAO` | Automático (NF de devolução) ou manual | Valor devolvido |
| Cliente usa crédito em novo pedido | `DEBITO_UTILIZACAO` | Manual, referenciando o pedido | Valor abatido |
| Correção | `CREDITO_AJUSTE` / `DEBITO_AJUSTE` | Manual, justificativa obrigatória | Livre |
| Cancelamento de lançamento | `ESTORNO` | Manual ou automático (NF cancelada); contrapartida vinculada | Igual ao original |
| Carga inicial | `CREDITO_SALDO_INICIAL` | Importação única com evidência | Planilha do financeiro |

Regras:

1. Nunca se edita ou apaga um lançamento. Correção é estorno + novo lançamento.
2. Saldo do cliente = soma dos lançamentos `confirmado`. Crédito positivo, débito negativo. Saldo negativo permitido e sinalizado.
3. Idempotência por `origem_tipo + origem_chave` única (ex.: `nf:8-12345`, `mov:8-9987`, `ruptura:8-77-3`).
4. Ruptura só após o faturamento da NF ligada ao pedido, uma vez por par pedido/NF; faturamento parcial usa o acumulado e um parâmetro "aguardar N dias após a primeira NF".
5. Manuais acima de R$ 5.000,00 (parâmetro) ficam `pendente_aprovacao` até um segundo usuário do financeiro aprovar; o aprovador não pode ser quem criou.
6. Contestação em até 30 dias (parâmetro); não altera saldo; abre chamado resolvido com estorno, ajuste ou indeferimento.
7. BRL com duas casas; fuso `America/Sao_Paulo`; datas do Result tratadas como data local.

### 3.2 Estados

```
rascunho → pendente_aprovacao → confirmado → estornado
                  └──────────→ rejeitado
```

### 3.3 Etapas da Torre de Créditos (por pedido)

```
Pago antecipado ─▶ Faturado (conferindo) ─▶ Crédito disponível ─▶ Crédito compensado
(aguardando NF)     (NF chegou; ruptura        (saldo > 0 do          (DEBITO_UTILIZACAO ou
                     calculada em até N dias)   pedido lançado)        ajuste zerou o pedido)
                                                     │
                                                     └──▶ Contestado (chamado aberto)
```

Cada card mostra cliente, pedido, valor pago, valor faturado, crédito gerado, dias na etapa e um alerta quando o crédito está parado além do limiar.

---

## 4. Arquitetura

### 4.1 Visão geral

```
                 VPS Digital Ocean (Ubuntu 24.04)
 ┌────────────────────────────────────────────────────────────────────┐
 │ nginx (TLS Let's Encrypt) ── creditos.<dominio>                     │
 │   ├── /            → PHP-FPM 8.3 · Laravel 12 (Inertia + Vue 3)     │
 │   ├── /api         → mesma aplicação (rotas API, Sanctum)           │
 │   └── /app (ws)    → Laravel Reverb (WebSocket)                     │
 │                                                                    │
 │ supervisor                                                         │
 │   ├── php artisan queue:work     (jobs: sync, regras, e-mails)      │
 │   ├── php artisan reverb:start   (tempo real)                       │
 │   └── cron: php artisan schedule:run a cada minuto                  │
 │                                                                    │
 │ mysql 8 (banco próprio: espelho + livro-razão + tenants + usuários) │
 │                                                                    │
 │ worker de sync ── PDO dblib (FreeTDS, READ UNCOMMITTED) ──────────────▶ Result / Ruby_SP
 │                   empresa 8, consultas incrementais                   (SQL Server)
 └────────────────────────────────────────────────────────────────────┘
```

Um único código Laravel serve web, API e jobs. Tempo real com Reverb (WebSocket em PHP, primeira parte do Laravel). Sem Redis obrigatório: fila e cache no MySQL; Redis entra se a fila crescer.

### 4.2 Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem / framework | PHP 8.3 + Laravel 12 | Pedido do projeto; ecossistema completo (auth, fila, scheduler, broadcast, testes) |
| Banco próprio | MySQL 8 (ou o mesmo servidor que o workspace já usa na VPS) | Comum em VPS PHP; Laravel suporta Postgres se preferir |
| Acesso ao Result | PDO `dblib` via FreeTDS (TDS 7.2 para compatibilidade com SQL Server 2008), conexão nomeada `result` com `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED` ao abrir | Driver oficial da Microsoft não cobre SQL Server 2008; FreeTDS cobre |
| Jobs e agendamento | Laravel Queue (driver database) + Scheduler | Retry, lock, cron sem infraestrutura extra |
| Tempo real | Laravel Reverb + Laravel Echo | WebSocket nativo do ecossistema, canais privados por tenant e por cliente |
| Front-end | Inertia.js + Vue 3 + Tailwind + componentes próprios | Sensação de SPA como o workspace, sem API duplicada; Livewire 3 é alternativa se o time preferir só PHP |
| Auth | Laravel Fortify (login, 2FA TOTP, reset) + Sanctum para API | Cliente entra com CNPJ + senha; financeiro com e-mail + senha + TOTP |
| Multi-tenant | Coluna `tenant_id` em todas as tabelas de domínio + global scope; conexão ERP configurada por tenant | Simples de operar; permite ativar outra filial sem novo deploy |
| Servidor web | Nginx + PHP-FPM, Certbot | Padrão da VPS |
| Deploy sem GitHub | Bare repo git na VPS + hook `post-receive` que roda `composer install`, `migrate`, `npm run build`, `queue:restart` | Versionamento e deploy sem serviço externo; Deployer via SSH como alternativa |
| Backups | `mysqldump` diário + arquivos → DO Spaces (retenção 30 dias); snapshot semanal do droplet | O livro-razão é o ativo |
| Observabilidade | Logs em `storage/logs` rotacionados, `/health`, tabela `sync_runs`, alerta por e-mail | Suficiente para uma VPS |

### 4.3 Rede com o Result

1. **Mesma VPS do conector** (recomendado): usa o DDNS interno e a porta 1433 já liberados; só precisa de login novo.
2. **Droplet novo na mesma VPC** da Digital Ocean: regra de firewall libera 1433 do IP privado do novo droplet até o gateway que hoje alcança o Result.
3. **Sem rota**: o conector Node ganha um destino a mais (POST para `/api/ingest/*` do app com token próprio), no padrão das rotinas `receber-*`. Plano B.

---

## 5. Modelo de dados (MySQL próprio)

### 5.1 Plataforma (SaaS)

| Tabela | Descrição |
|---|---|
| `tenants` | id, nome, cnpj, `erp_empresa_id` (8), conexão ERP (host, base, usuário, senha cifrada), parâmetros padrão, ativo |
| `users` | tenant_id, nome, e-mail, senha (argon2id), perfil (`financeiro`, `financeiro_aprovador`, `admin`, `cliente`), `cliente_id` quando perfil cliente, TOTP, ativo |
| `parametros` | tenant_id, limite aprovação dupla, prazo contestação, cadência sync, dias de espera da ruptura, limiar "crédito parado" |
| `audit_log` | tenant_id, user_id, ação, entidade, antes/depois (JSON), IP, hash encadeado com o registro anterior |

### 5.2 Espelho do Result (escrito só pelo worker)

| Tabela | Chave | Colunas principais |
|---|---|---|
| `erp_clientes` | tenant, código | cnpj, razão social, uf, cidade, vendedor, limite, bloqueio, inativo, `raw` JSON, `sincronizado_em` |
| `erp_pedidos` / `erp_pedido_itens` | tenant, pedido [, sequência] | cliente, data, etapa, total, condição, nf, carimbos; itens com qtd, preço, desconto |
| `erp_notas` / `erp_nota_itens` | tenant, nf, série [, sequência] | pedido, cliente, emissão, valor líquido, tipo (saída/devolução), cancelada; itens com qtd faturada |
| `erp_movimentos` | tenant, id ERP | data, valor, entrada/saída, documento, pedido, conta |
| `erp_titulos` | tenant, tipo, nota, parcela, cliente | original, pago, em aberto, emissão, vencimento, pagamento, pedido, chave NF-e |
| `erp_orcamentos` (se confirmado) | tenant, orçamento | cliente, validade, situação, pedido gerado, itens |
| `sync_runs` / `sync_solicitacoes` | id | entidade, início, fim, lidas, gravadas, erro / solicitado_por, alvo, status |

### 5.3 Domínio

| Tabela | Descrição |
|---|---|
| `clientes` | tenant, código ERP, vínculo a usuários do portal, e-mail de notificação, flags |
| `lancamentos` | **Append-only.** tenant, cliente, tipo, valor (DECIMAL 14,2), status, origem_tipo, origem_chave (única), pedido, nf, item, descrição, justificativa, criado_por, aprovado_por, estorna_lancamento_id, datas |
| `saldos_cliente` | tabela mantida por evento (saldo, créditos pendentes, último lançamento) |
| `pedidos_credito` | estado do pedido na Torre de Créditos: etapa, entrou_na_etapa_em, valor pago, faturado, crédito gerado, compensado |
| `contestacoes` / `contestacao_mensagens` | chamado do cliente e thread |
| `anexos` | comprovantes em `storage/app/tenants/<id>/clientes/<id>/`, 20 MB, validação por tipo real |
| `notificacoes` | fila de e-mail/WhatsApp com status |

No banco: usuário MySQL da aplicação sem `UPDATE`/`DELETE` em `lancamentos` (apenas `INSERT` e mudança de status por procedure); índice único em `(tenant_id, origem_tipo, origem_chave)`.

---

## 6. Integração com o Result

### 6.1 Descoberta (semana 1, com o suporte Result)

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
 WHERE TABLE_NAME LIKE '%Nota%' OR TABLE_NAME LIKE '%NF%' OR TABLE_NAME LIKE '%Pedido%'
    OR TABLE_NAME LIKE '%Orcamento%' OR TABLE_NAME LIKE '%Item%' OR TABLE_NAME LIKE '%Movimento%'
 ORDER BY TABLE_NAME;
SELECT TOP 20 * FROM ConsultaPowerBIReceber WHERE [ID Empresa] = 8 ORDER BY [Emissão] DESC;
```

Entregável: `docs/result-schema-pe.md` no repositório local com query final, chave, coluna de "atualizado em" e volume diário de cada entidade na empresa 8. As queries do conector atual (`connector-rubysp/src/*.js` na VPS) são o ponto de partida: os SELECTs de pedidos, itens, clientes e movimentos já existem lá e serão portados para PHP.

### 6.2 Sincronização (jobs Laravel)

| Job | Cadência | Estratégia | Volume (empresa 8) |
|---|---|---|---|
| `SyncClientes` | 1 h | Full filtrado por filial | centenas |
| `SyncPedidos` | 5 min | Janela de 7 dias por data/etapa | dezenas/dia |
| `SyncNotas` | 5 min | Janela de 7 dias por emissão | dezenas/dia |
| `SyncMovimentos` | 5 min | Janela de 7 dias | dezenas/dia |
| `SyncTitulos` | 15 min | Janela de 30 dias | centenas |
| `ReconciliacaoDiaria` | 05:30 | Full de 90 dias | — |
| `ProcessarSolicitacoes` | 1 min | Consome `sync_solicitacoes` (botão "Atualizar agora") | — |

Cada job grava em `sync_runs`; três falhas seguidas alertam o admin; a barra de sincronização mostra o frescor.

### 6.3 Motor de regras (`App\Domain\Credito\Motor`, roda após cada sync)

1. Movimento de entrada com pedido ainda não faturado → `CREDITO_ANTECIPACAO`; pedido entra em "Pago antecipado".
2. Título com valor pago e sem NF → `CREDITO_ANTECIPACAO` (dedupe com 1).
3. NF de saída nova → `DEBITO_FATURAMENTO`; pedido vai para "Faturado (conferindo)".
4. Após N dias da primeira NF (ou quando a etapa do pedido no Result passa de faturado): itens pedidos x faturados → `CREDITO_RUPTURA` por item; pedido vai para "Crédito disponível" ou "Compensado".
5. NF de devolução → `CREDITO_DEVOLUCAO`.
6. NF cancelada depois de lançada → `ESTORNO` automático com aviso ao financeiro.

Classe pura, sem I/O, testada com PHPUnit usando cenários reais anonimizados da empresa 8.

---

## 7. Tempo real: pagador e recebedor

- Evento `LancamentoRegistrado` disparado após cada `INSERT` em `lancamentos` (e `ContestacaoAtualizada`, `SyncAtualizado`).
- Broadcast por Reverb em canais privados `tenant.{id}.financeiro` e `tenant.{id}.cliente.{clienteId}`.
- Front (Laravel Echo) atualiza saldo, extrato e Kanban sem recarregar, destacando o novo lançamento.
- E-mail transacional ao cliente por lançamento confirmado; resumo diário ao financeiro. WhatsApp opcional (fase 4).
- Latência: até 5 min (cadência do sync) + segundos.

---

## 8. Perfis e telas

| Perfil | Vê | Faz |
|---|---|---|
| Cliente | Só o próprio saldo, extrato, pedidos, NFs, contestações | Contesta, anexa, exporta |
| Financeiro | Todos os clientes do tenant | Lançamento manual, responde contestação, registra uso de crédito |
| Financeiro aprovador | Idem | Aprova acima do limite (não os próprios) |
| Admin do tenant | Tudo + parâmetros, usuários, sync | Gerencia usuários, parâmetros, sync |
| Super admin (plataforma) | Todos os tenants | Cria tenant, configura conexão ERP |

**Financeiro**: Torre de Créditos (Kanban) · Carteira (tabela com saldo, pendentes, contestações) · Cliente (saldo, timeline, pedidos, contestações) · Novo lançamento · Aprovações · Conciliação · Sincronização.

**Cliente (portal)**: Meu saldo · Extrato · Meus pedidos (orçamento → pedido → NF → itens cortados) · Contestações.

Fluxos-chave: antecipação → crédito; faturamento com ruptura → débito + créditos por item; uso de crédito → `DEBITO_UTILIZACAO` com aprovação; contestação → resposta com estorno/ajuste/indeferimento.

---

## 9. Segurança e conformidade

- Login do Result exclusivo, `db_datareader`, restrito por firewall ao IP privado da VPS; credenciais em `.env` fora do repositório e cifradas por tenant no banco.
- MySQL só em `localhost`/rede privada; backups cifrados no DO Spaces.
- Senhas argon2id; TOTP obrigatório para financeiro; bloqueio após 5 tentativas; sessão 8 h (financeiro) e 24 h (cliente).
- Autorização por policies do Laravel em toda rota; teste automatizado "cliente A tenta ler cliente B"; escopo por tenant em toda query.
- CSP, HSTS, X-Frame-Options no Nginx; rate limit por IP e sessão.
- Upload 20 MB, validação por tipo real, sem dupla extensão, fora do `public/`.
- LGPD: minimização das colunas espelhadas, log de acesso a dados de cliente, exclusão de usuário a pedido.
- Auditoria imutável; validação de request via Form Requests; queries sempre parametrizadas (nenhum SQL por concatenação, inclusive no FreeTDS).

---

## 10. Fases, entregas e cronograma

| Fase | Semanas | Entregas | Pronto quando |
|---|---|---|---|
| **0. Descoberta e acesso** | 1 | Login read-only, FreeTDS validado na VPS, `docs/result-schema-pe.md`, planilha de saldo inicial, parâmetros acordados, subdomínio e TLS | `SELECT TOP 1` de cada entidade roda do PHP na VPS e as chaves estão fechadas |
| **1. Fundação e espelho** | 2 | Projeto Laravel, tenants, auth com TOTP, jobs de sync das 6 entidades, barra de sincronização, deploy por bare repo, backup | Espelho da empresa 8 atualizando a cada 5 min há 3 dias sem erro |
| **2. Livro-razão e Torre** | 2 | `lancamentos`, motor de regras com testes, carga inicial, Torre de Créditos, Carteira, Cliente, Novo lançamento, Aprovações, audit log | 20 clientes conferidos contra a planilha batem; rupturas do último mês reproduzidas |
| **3. Portal do cliente e tempo real** | 2 | Auth do cliente, telas do portal, Reverb + Echo, e-mail transacional, exportações | Cliente piloto vê o crédito de uma ruptura real minutos após o faturamento |
| **4. Conciliação, hardening e go-live** | 1 | Conciliação diária, alertas, testes de autorização, revisão de segurança, manual do financeiro | Uma semana de operação paralela sem divergência não explicada |
| **Homologação assistida** | 2 | 5 a 10 clientes piloto em uso real; ajustes de regra | Financeiro aprova abertura para todos os clientes PE |
| **5. (opcional)** | 1 | API read-only de saldo (`/api/v1/clientes/{codigo}/saldo`, token) para o workspace ou o bimaster consumirem | Saldo visível na Torre de Pedidos |

Equipe: 1 dev PHP/Laravel integral; key-user do financeiro (4 h/semana nas fases 0, 2 e homologação); suporte Result (fase 0); admin da VPS (fases 0 e 4).

---

## 11. Riscos e decisões pendentes

| # | Risco / decisão | Impacto | Mitigação |
|---|---|---|---|
| 1 | Nomes das tabelas de NF/itens e vínculo pedido → NF | Bloqueia a ruptura | Descoberta na fase 0; portar os SELECTs do conector atual |
| 2 | Time Result só aceitar consultas fora do horário comercial | "Tempo real" vira "próximo dia" | Negociar 5 min só na empresa 8 com queries por índice de data; plano B via conector (30 min) |
| 3 | FreeTDS com SQL Server 2008 (TDS 7.2) | Sync não conecta | Validar na fase 0 com `tsql -S`; alternativa: conector Node empurra para `/api/ingest` |
| 4 | Onde o pagamento antecipado aparece (movimento, título ou ambos) | Crédito duplicado | 10 casos reais na fase 0; dedupe por documento |
| 5 | Faturamento parcial | Ruptura fechada cedo | Acumulado + parâmetro de espera |
| 6 | Saldo inicial sem lastro | Disputas | Carga exige anexo e assinatura do responsável |
| 7 | Crédito não existe no Result; vendedor pode não abater | Cliente paga de novo | Alerta quando cliente com saldo tem pedido novo pago integral; fase 5 leva o saldo à Torre de Pedidos |
| 8 | VPS compartilhada com workspace e conector | Concorrência de recursos | Pools de PHP-FPM separados, limites de memória, monitor de carga; droplet dedicado se passar de 70% de uso |
| 9 | Um único dev | Continuidade | Repositório local versionado, README de operação, backups testados |

Decisões de negócio antes da fase 2: limite da aprovação dupla (proposta R$ 5.000,00); prazo de contestação (30 dias); crédito expira? (não na v1, relatório de parados há mais de 180 dias); cliente inativo com saldo vê o portal? (sim, leitura); vendedor tem leitura da carteira? (não na v1); dias de espera para fechar ruptura (proposta 2 dias úteis).

---

## 12. Infraestrutura e custos (Digital Ocean)

| Item | Especificação | Custo mensal |
|---|---|---|
| Droplet | Reaproveitar a VPS atual, ou novo Basic 2 vCPU / 4 GB / 80 GB na mesma VPC | US$ 0 ou US$ 24 |
| Spaces (backup) | 250 GB, retenção 30 dias | US$ 5 |
| Snapshots do droplet | Semanal | ~US$ 1 a 2 |
| E-mail transacional | Resend, SES ou Postmark, até 10 mil/mês | US$ 0 a 20 |
| Domínio | `creditos.<dominio>` com Let's Encrypt | existente |
| Monitoramento | DO Monitoring + uptime externo gratuito | US$ 0 |

Opcional: DO Managed MySQL (US$ 15/mês) se quiser o banco fora do droplet com backup automático.

---

## Apêndice A — Estrutura do projeto Laravel

```
creditos-clientes/
├── app/
│   ├── Domain/Credito/        Motor de regras (puro), tipos de lançamento, cálculo de ruptura
│   ├── Models/                Tenant, User, Cliente, Lancamento, PedidoCredito, Contestacao, Erp*
│   ├── Jobs/Sync/             SyncClientes, SyncPedidos, SyncNotas, SyncMovimentos, SyncTitulos, Reconciliacao
│   ├── Services/Result/       Conexão FreeTDS, queries por entidade (portadas do conector)
│   ├── Events/                LancamentoRegistrado, ContestacaoAtualizada, SyncAtualizado
│   ├── Policies/              Autorização por tenant e perfil
│   └── Http/Controllers/      Web (Inertia) e API
├── database/migrations/
├── resources/js/Pages/        Torre, Carteira, Cliente, Lancamento, Aprovacoes, Conciliacao, Sync, Portal/*
├── routes/web.php · api.php · channels.php
├── tests/Unit/Domain          Motor de regras
├── tests/Feature              Autorização, fluxos, ingest
├── deploy/                    nginx.conf, supervisor.conf, post-receive hook, backup.sh
└── docs/                      result-schema-pe.md, regras-de-credito.md, operacao.md
```

## Apêndice B — Contrato mínimo da API

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/login`, `/logout`, `/two-factor-challenge` | todos | Sessão (Fortify) |
| GET | `/api/clientes?busca=&saldo=` | financeiro | Carteira |
| GET | `/api/clientes/{id}` | financeiro, cliente (próprio) | Cabeçalho + saldo |
| GET | `/api/clientes/{id}/lancamentos` | idem | Extrato paginado |
| POST | `/api/lancamentos` | financeiro | Lançamento manual |
| POST | `/api/lancamentos/{id}/aprovar` · `/rejeitar` · `/estornar` | aprovador | Aprovação |
| GET | `/api/torre/pedidos?etapa=&parados=` | financeiro | Torre de Créditos |
| GET | `/api/clientes/{id}/pedidos` | idem | Pedidos com NF e rupturas |
| POST | `/api/lancamentos/{id}/contestacoes` | cliente | Abrir contestação |
| POST | `/api/contestacoes/{id}/mensagens` | cliente, financeiro | Thread |
| GET | `/api/conciliacao?dia=` | financeiro | Divergências |
| GET | `/api/sync/status` · POST `/api/sync/solicitar` | admin | Sincronização |
| WS | Reverb: `tenant.{id}.financeiro`, `tenant.{id}.cliente.{clienteId}` | todos | Eventos em tempo real |
| POST | `/api/ingest/{entidade}` | token do conector (plano B) | Recepção de lotes |
| GET | `/api/v1/clientes/{codigo}/saldo` | token (fase 5) | Integração externa |
