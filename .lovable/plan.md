
# Plano: Sync nativo de Contas a Pagar via SELECT direto no ERP (sem n8n)

## Restrições absolutas (invariantes)

1. **Não alterar nada no banco SQL do cliente.** Acesso é estritamente `SELECT` — nenhum `INSERT/UPDATE/DELETE/ALTER`.
2. **Não alterar nenhuma API do Portal ERP.** Os endpoints atuais que o ERP consome (`/contas-pagar-api/incluir`, `/upsert`, etc.) ficam intocados.
3. **Sem downtime.** Substituição opera em paralelo ao n8n até validação; n8n é desligado depois.

## O que descobri

- O n8n hoje executa: lê o SQL do cliente via os secrets `ERP_SQL_HOST/PORT/DATABASE/USER/PASSWORD`, transforma em JSON e POSTa em `/contas-pagar-api/bulk-sync`. Esses secrets já estão configurados no nosso projeto.
- Toda a infra de **escrita no nosso lado já existe**: `processRecordsWithRetry`, `bulk-sync`, `sync-incremental`, `sync_control`, idempotência por hash, etc. Não precisamos criar nada de processamento — só substituir o n8n pela leitura SQL.
- Contas a Receber já fez essa migração: não há mais função `contas-receber-n8n-sync` nem disparo para n8n na CR.

## Arquitetura proposta

```text
ANTES:
Botão UI / cron externo ─► trigger-n8n ─► n8n cloud ─► SELECT no ERP ─► POST /bulk-sync ─► nosso DB

DEPOIS:
Botão UI / pg_cron interno ─► /contas-pagar-api/pull-erp ─► SELECT direto no ERP ─► processRecordsWithRetry ─► nosso DB
                                  (read-only, mesmas credenciais que o n8n usava)
```

## Componentes que serão criados / alterados

### 1. Nova edge function: `contas-pagar-erp-pull`
Função isolada e dedicada para o pull. Por que função separada e não rota dentro de `contas-pagar-api`:
- Isola o driver Postgres (Deno `postgres@v0.17`) do bundle da API principal.
- Permite timeout maior (até 150s) sem afetar latência da API REST.
- Pode ser desligada/reativada sem impactar a API que o ERP consome.

Comportamento:
- **Auth**: JWT admin OU API Key interna (`X-Internal-Key` validada contra `QUEUE_PROCESSOR_SECRET` que já existe).
- **Conexão**: `postgres` client com `tls: { enabled: true, enforce: true }` e `read_only: true` no pool. Connection string montada a partir dos secrets `ERP_SQL_*`.
- **Query**: replica exatamente o `SELECT` que o n8n fazia. Antes de codar, faço uma rodada manual de inspeção via `curl_edge_functions` para descobrir o shape que o `processRecordsWithRetry` espera (já está documentado em `_shared/contas-pagar/utils.ts` — campos como `Codigo Lancamento`, `ID Empresa`, `Data Vencimento`, etc.). Uso a mesma lista de colunas que o n8n usava — vou pedir ao usuário a query do n8n se não conseguir reconstruir 100% pelo formato esperado no `transformErpData`.
- **Filtro incremental**: `WHERE data_alteracao >= $1` onde `$1 = última sync do `sync_control` − 1 dia` (margem de segurança). Sem cláusula → falha (proteção contra full-table-scan acidental).
- **Paginação**: `LIMIT 5000 OFFSET ?` com loop até esgotar. Cada página é processada por `processRecordsWithRetry` antes da próxima — não acumula tudo em memória.
- **Audit log**: cada execução grava em `sync_control` com `entidade='contas_pagar'`, `origem='erp_pull_nativo'`, contadores e duração.

### 2. Endpoint orquestrador `POST /contas-pagar-api/pull-now`
Rota nova em `contas-pagar-api/index.ts` que apenas dispara `contas-pagar-erp-pull` via `supabase.functions.invoke()` e retorna 202 Accepted com `sync_id`. UI mostra progresso lendo `sync_chunks_progress` (já existe).

### 3. Cron interno via pg_cron (substitui o cron do n8n)
Schedule a cada 15 minutos chamando `/contas-pagar-api/pull-now`. Vou usar `supabase--insert` (não migration) porque o SQL contém URL e anon key — assim o cron não vaza para outros projetos remix. Implementação segue o padrão documentado.

### 4. Aposentar n8n (sem deletar)
- Endpoint legado `POST /contas-pagar-api/trigger-n8n`: muda implementação para chamar internamente `pull-now`. Adiciona header `Deprecation: true` e `Sunset: <data+30d>`. Preserva o contrato HTTP — qualquer integração antiga continua funcionando, só que agora roda 100% nativo.
- Edge function `contas-pagar-n8n-sync`: mantida ativa por 7 dias. Adiciona log "deprecated path used by <caller>" para identificar se ainda há tráfego. Após 7 dias zerados, troca para `410 Gone`.
- Secret `N8N_CONTAS_PAGAR_WEBHOOK`: removido só na Etapa final, depois de validação.
- Secret `N8N_API_KEY`: **mantido** — é usado para autenticar o Portal ERP nas chamadas de entrada (verificado em `contas-pagar-api/index.ts` linha 75). Nome legado, função vital.

### 5. UI
- `N8NTabContent.tsx` → renomear para `SincronizacaoErpTab.tsx`. Botão "Disparar N8N" vira "Sincronizar Agora". Trocar chamada de `/trigger-n8n` para `/pull-now`. Remover toda menção a "N8N" e "workflow".
- `ContasPagarSyncPanel.tsx`: a aba que hoje se chama "N8N" passa a se chamar "Sincronização ERP". Sem mudança estrutural.
- Mantém status da última sincronização, contagem, duração — vem de `sync_control` que já é populada.

## Etapas de execução (ordem segura)

1. **Inspeção** (5 min): conferir em `_shared/contas-pagar/utils.ts` o shape exato que `transformErpData` espera, para construir a query SQL idêntica ao que o n8n entregava. Se ficar dúvida em algum campo, perguntar ao usuário.
2. **Função `contas-pagar-erp-pull`** (criar): conexão read-only, query incremental, paginação, log em `sync_control`. Deploy isolado.
3. **Teste manual** via `curl_edge_functions`: rodar `pull-erp` e validar que (a) inseriu/atualizou registros corretos, (b) `sync_control` recebeu linha de sucesso, (c) zero comandos de escrita no banco do cliente (visível pelo log do driver).
4. **Endpoint `pull-now`** em `contas-pagar-api`.
5. **Cron pg_cron** via `supabase--insert` (não migration, contém URL+anon key).
6. **UI**: renomear aba, trocar endpoint chamado.
7. **Deprecar** `trigger-n8n` (apontar para `pull-now`) e ligar log de monitoração no `contas-pagar-n8n-sync`.
8. **Aguardar 7 dias** (você decide quando), confirmar tráfego zero no n8n-sync, e então: remover `N8N_CONTAS_PAGAR_WEBHOOK`, retornar 410 em `contas-pagar-n8n-sync`, desligar workflow no n8n cloud.

## Verificações de segurança / read-only

- Pool Postgres aberto com `application_name='lovable_cp_pull_readonly'` para rastreamento no lado do cliente.
- Antes de qualquer query, executa `SET TRANSACTION READ ONLY;` e `SET statement_timeout = '120s';`. Qualquer DML lançará erro do próprio Postgres.
- Lista de queries permitidas é fixa no código (sem string concat com input do usuário). Apenas SELECTs.
- Log de auditoria interno (`access_audit_log`) registra cada execução com user_id (admin/cron), tipo `erp_pull` e número de linhas lidas.

## Critérios de aceite

1. Botão "Sincronizar agora" no painel CP traz dados do ERP sem chamar `n8n.cloud`.
2. Cron pg_cron a cada 15 min mantém CP sincronizado.
3. `sync_control` mostra `origem='erp_pull_nativo'` nas novas execuções.
4. Endpoint `/contas-pagar-api/incluir` (usado pelo Portal ERP) responde idêntico ao antes — testado com `curl_edge_functions`.
5. Logs de Postgres do ERP do cliente mostram apenas conexões com `application_name='lovable_cp_pull_readonly'` e apenas comandos SELECT.
6. n8n pode ser desligado no cloud sem qualquer impacto.

## Pergunta antes de começar

Para construir a query SQL idêntica ao que o n8n entrega hoje, preciso saber qual é a tabela e as colunas que o n8n consulta no ERP (provavelmente uma view tipo `vw_contas_pagar` ou tabela `lancamentos_pagar`). Dois caminhos:

(a) Você me envia a query SQL do workflow do n8n (1 cópia/cola do node SQL).
(b) Eu olho o shape em `_shared/contas-pagar/utils.ts` (`transformErpData`) e infiro os nomes prováveis (`Codigo Lancamento`, `ID Empresa`, etc.). Depois rodo a função em modo "dry-run" (faz SELECT mas não grava em nosso DB) e te mostro 3 linhas de amostra para você confirmar antes de ligar a sincronização real.

Recomendo o caminho **(a)** se você tiver a query à mão — economiza 1 ciclo. Caso contrário, **(b)** é seguro porque o dry-run não toca em nada (nem no ERP além do SELECT, nem no nosso DB).
