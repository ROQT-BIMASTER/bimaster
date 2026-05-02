# Plano de Testes Pré-Publicação

Antes de publicar a nova versão, validar de ponta a ponta as áreas tocadas nos últimos hotfixes (RLS de aprovações, RLS de Vincular China, GRANT EXECUTE em SECURITY DEFINER, Kanban de alçadas).

## Escopo dos testes

### 1. Banco / Permissões (server-side)
- Confirmar `cloud_status = ACTIVE_HEALTHY`.
- Rodar `supabase--linter` e revisar warnings novos.
- Query nas tabelas `pg_proc` para confirmar que todas as funções `SECURITY DEFINER` usadas em RLS têm `EXECUTE` para `authenticated` (verificação do hotfix `20260502211146`).
- Conferir policies ativas em `china_produto_submissoes`, `china_produto_documentos`, `aprovacao_lotes`, `aprovacao_etapas`, `aprovacao_acoes`.
- Varrer `postgres_logs` últimas 2h por `permission denied` / `RLS` / `42501`.

### 2. Smoke test navegando como usuário (browser tool)
Logado com a sessão atual do preview:
- **/dashboard/projetos/central** — lista de projetos carrega, KPIs preenchidos, sem 403/500 no network.
- **/dashboard/projetos/vincular-china** — produtos (23+) e documentos visíveis no painel lateral.
- **/dashboard/central/aprovacoes** — KPIs, filtros e Kanban renderizam; abrir um lote.
- **Projeto → Tarefa com alçadas** — abrir detalhe da tarefa, verificar bloco de lotes de aprovação, criar lote de teste, avançar etapa, mover lote para outra tarefa (RPCs `rpc_criar_lote_aprovacao`, `rpc_avancar_etapa_aprovacao`, `rpc_mover_lote_para_tarefa`).
- **/admin/templates-alcadas** — listar, abrir e editar template.
- **/dashboard/fabrica** (amostra) — confirmar que ficha de produto/custo abre (regressão do GRANT EXECUTE).
- **/dashboard/financeiro** (amostra DRE / Contas a Pagar) — listas carregam.
- **/dashboard/trade** (amostra PDV) — lista de lojas carrega.

### 3. Verificações cruzadas
- Console do preview limpo (sem erros novos além de avatares Asana expirados, já conhecidos).
- Network: nenhuma chamada RPC/REST retornando 401/403/500 nos fluxos acima.
- Realtime de aprovações: alteração em um lote reflete na Central sem reload.

### 4. Critério de Go/No-Go
- **GO**: todas as telas acima carregam dados, fluxo de criar+avançar lote funciona, zero `permission denied` em logs durante o teste, zero 4xx/5xx novos no network.
- **NO-GO**: qualquer tela voltando vazia para perfis válidos, qualquer RPC de aprovação falhando, ou erro de RLS em logs → reportar ao usuário com diagnóstico antes de publicar.

### 5. Entregável
Relatório curto no chat com:
- Status por área (OK / falha + evidência).
- Lista de eventuais correções necessárias antes do publish.
- Recomendação final (Publicar / Segurar).

## Detalhes técnicos

- Ferramentas: `supabase--cloud_status`, `supabase--linter`, `supabase--read_query`, `supabase--analytics_query` (postgres_logs e edge logs últimas 2h), `browser--navigate_to_sandbox` + `observe`/`screenshot`/`list_network_requests`.
- Não executar ações destrutivas: lotes de teste criados serão removidos ou marcados; nenhuma exclusão em dados reais de produção.
- Não alterar código nesta etapa — apenas auditar. Se algo quebrar, retorno ao usuário com plano de fix antes de qualquer edit.
