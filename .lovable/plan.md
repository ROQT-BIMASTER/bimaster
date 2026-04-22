

# Restaurar sync N8N → Contas a Receber sem afetar APIs do Portal

## Diagnóstico (confirmado em `sync_control`)

| Janela | Status | Tempo | Registros |
|---|---|---|---|
| Até `04:19:07` | success | ~60s | 9.000/lote |
| `04:22:04` em diante (13 execuções consecutivas) | error | **121.150 ms** | 0 |

**Erro real do N8N:** `SQL query failed: Timeout: Request failed to complete in 120000ms`

**Origem:** o nó **SQL Query (lendo do ERP)** dentro do workflow N8N de Contas a Receber estoura o **timeout default de 120s do nó**. Não é a `contas-receber-api` que falha — o N8N nem envia payload pra ela nesse cenário (`total_registros = 0`). A query no ERP cresceu de ~60s para >120s e travou tudo.

**Confirmação adicional:**
- `offset_cursor` está sempre `0` → o workflow não está paginando incrementalmente; refaz a leitura completa toda vez.
- Cada execução pegava sempre os mesmos 9.000 mais recentes (LIMIT 9000 + ORDER BY data desc no ERP).
- O cron do N8N está em **2 minutos** (a doc diz 40 min — desatualizada). Como cada execução leva 60-120s, está rodando praticamente em loop.

## O que ajustar **no N8N** (você executa lá)

### Ajuste 1 — Aumentar timeout do nó SQL Query (correção crítica)

No nó **"SQL Query (ERP)"** do workflow `contas-receber`:

1. Abrir o nó → aba **Settings**.
2. **Timeout (ms)** → mudar de `120000` para **`300000`** (5 min).
3. Em **Settings → Continue On Fail** → manter `false` (queremos saber quando falhar).
4. Em **Settings → Retry On Fail** → habilitar com `Max Tries = 2`, `Wait Between Tries = 5000`.

### Ajuste 2 — Reduzir tamanho do lote no SQL do ERP (alívio imediato)

Na query do nó SQL Query do ERP, trocar:

```sql
SELECT TOP 9000 ...
ORDER BY data_atualizacao DESC
```

por

```sql
SELECT TOP 3000 ...           -- de 9000 → 3000
WHERE data_atualizacao >= DATEADD(MINUTE, -45, GETDATE())  -- janela incremental
ORDER BY data_atualizacao DESC
```

Justificativa: tempos de 60s já indicavam saturação; dividir em 3 lotes menores volta para a faixa de 20-25s, com folga.

### Ajuste 3 — Ajustar o cron schedule do workflow

No nó **Schedule Trigger**:

- Mudar de `*/2 * * * *` (a cada 2 min) para **`*/15 * * * *`** (a cada 15 min).

Justificativa: com 3.000 registros/janela e atualizações reais do ERP <500/min, 15 min é suficiente. Reduz pressão sobre o ERP em 7,5×.

### Ajuste 4 — Verificar URL do POST no nó HTTP Request (NÃO mudar)

Confirmar que o nó HTTP Request final continua apontando para:

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync
```

com header `x-api-key: cr_sync_2024_f7k9Lm3nPqRs8tUv` e body `{ "records": {{ JSON.stringify($items().map(i => i.json)) }} }`.

**Não tocar nesta URL.** É a única integração N8N → CR que existe. As APIs do Portal ERP (CRUD de Contas a Receber para integradores externos) usam outras rotas (`/query`, `/consultar`, `/incluir`, etc.) e API Keys distintas — ficam intactas.

## O que vou fazer **no código** (mínimo, sem mexer no Portal)

### Arquivo único: `supabase/functions/contas-receber-api/index.ts`

Adicionar dois ajustes defensivos no handler `/sync` (linhas 852-888) — preserva contrato de resposta:

1. **Validar payload vazio mais cedo** com mensagem clara para o N8N (atualmente já trata, mas sem log de origem). Adicionar `console.warn` com `origin=n8n` para facilitar correlação em `edge_function_logs`.
2. **Aceitar payload com `data_atualizacao_min`** opcional no body para permitir o N8N enviar a janela usada — registramos no `auditLog` para diagnóstico futuro.
3. **Limitar processamento por chamada a 5.000 registros** com 413 explícito se exceder — protege a API caso o N8N volte a empurrar lotes muito grandes.

Nenhum bump de SDK, OpenAPI ou `APP_VERSION`. Nenhum `ApiDocumentation.tsx`. Apenas hardening interno do handler `/sync`, que não está listado no portal público.

### Limpar entradas de erro acumuladas em `sync_control`

Após confirmar que o N8N voltou a sincronizar com sucesso (1 execução verde), inserir uma marca de retomada via SQL (sem deletar histórico):

```sql
INSERT INTO sync_control (entidade, status, ultima_sync, total_registros, workflow_name)
VALUES ('contas_receber', 'success', now(), 0, 'manual_recovery_marker');
```

## Validação pós-ajuste

1. Rodar manualmente o workflow N8N (botão Execute Workflow).
2. Verificar `sync_control` → nova linha `status=success` com `total_registros > 0` e `duracao_ms < 60000`.
3. Conferir `MAX(sincronizado_em)` na `contas_receber` avançou.
4. Smoke test no Portal: `GET /contas-receber-api/status` → 200 (confirma que API pública continua íntegra).
5. Smoke test no Portal: `GET /contas-receber-api/query?limit=10` com API Key de integrador → 200 com dados.

## Não-escopo (preservado intacto)

- Endpoints públicos do Portal ERP — Contas a Receber: `/query`, `/consultar`, `/incluir`, `/upsert`, `/upsert-lote`, `/lancar-recebimento`, `/cancelar`, `/estornar`, `/parcelas`, `/recebimentos`, `/anexos`, `/conciliar`, `/desconciliar`. Nenhum deles é tocado.
- `ApiDocumentation.tsx`, SDK, OpenAPI, `APP_VERSION` — sem bump.
- `secureHandler`, WAF, RLS, idempotência centralizada — sem alteração.
- API Key do integrador externo (tabela `api_keys`) — sem rotação.
- A API Key do N8N (`cr_sync_2024_f7k9Lm3nPqRs8tUv`) continua a mesma — separada da chave de integradores.

## Impacto

**Risco baixo.** Ajustes 1-3 são apenas configuração no painel do N8N (você executa) — efeito imediato, sem deploy. Ajuste 4 (código) é hardening interno do handler `/sync` que o integrador externo nem enxerga, contrato de resposta mantido (`{ success, processed, total }`). Se algo der errado, basta reverter o nó SQL do N8N para o limite anterior — APIs do Portal seguem funcionando porque são caminhos independentes que apenas convergem na mesma tabela `contas_receber`.

