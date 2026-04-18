

## Diagnóstico — explorar antes de planejar

Preciso validar 7 sub-itens (3A-3G) contra o estado real. A Onda 2 deixou alguns sinais nos logs (`/cancelar` ok, `/estornar` ok, `/lancar-pagamento` ok), então o ciclo principal está verde. Agora preciso ler os handlers de query/parcelas/pagamentos/anexos/update para identificar bugs antes de tocar.
<lov-tool-use id="toolu_vrtx_01PTDKv6Qyw7d1FCjpYhj4Jm" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/_shared/contas-pagar\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Xwqh1voZWuriBVJukJBW2q" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/parcela-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01N9rCMYshZeqQJShZCoVhaQ" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/anexo-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01D1hxa6BycGaMJjJMKsW8X8" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/crud-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DGk9aEG2Apvnzt6f6a7hhk" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/contas-pagar-api/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01V25p61Pk77oie5jFFR7rMg" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/_shared/contas-pagar\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XuWSE9n14HHsBgXhnH7PPa" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/contas-pagar-api/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GtxjwdL3DyugVsJAL8BmR4" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/parcela-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BSgcUHp6TwxVRoUkDTNvDG" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/anexo-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PjcXvUEGmowGtXghivTik3" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/payment-handlers.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011h4ur4ZUyACtNUiSKgT5fo" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='parcelas' ORDER BY ordinal_position;\\\"\", \"user_facing_description\": \"Inspecionando colunas reais da tabela parcelas\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WYQUofsKzSJK7W3sooVMBZ" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_attachments' ORDER BY ordinal_position;\\\" && psql -c \\\"SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.parcelas'::regclass;\\\"\", \"user_facing_description\": \"Inspecionando colunas de payment_attachments e constraints de parcelas\"}">
</lov-tool-use>
Critical findings:

1. **`payment_attachments` table does NOT exist** → `handleGetAnexos`/`handlePostAnexos` will throw 500 on every call.
2. **`parcelas` table has no UNIQUE constraint** on `(conta_pagar_id, numero_parcela)` → upsert with `onConflict: 'id'` requires the client to provide `id`. Spec sends `numero` (not `numero_parcela`) and no `id` → will fail or duplicate.
3. **Field mapping mismatch**: spec sends `numero` but column is `numero_parcela`.
<lov-tool-use id="toolu_vrtx_01HieVuW1mnZLYoTrcU8Ymqk" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%anex%' OR table_name ILIKE '%attach%' OR table_name ILIKE '%file%') ORDER BY table_name;\\\"\", \"user_facing_description\": \"Procurando tabela real de anexos\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01VPYu31jMEcDUeCQYxtPWB7" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/_shared/contas-pagar/crud-handlers.ts\"}">
</lov-tool-use>
Confirmed: there's no anexos table at all (`payment_attachments` doesn't exist; `documento_anexos` exists but unrelated). I have enough.

<lov-plan>

## Diagnóstico — Onda 3 tem 3 bugs reais (1 crítico) e o resto OK

Validei cada item da spec contra schema real + handlers atuais. Resumo:

| Item | Estado real | Ação |
|---|---|---|
| **3A — Query** | `handleQuery` aceita todos os filtros pedidos, paginação por offset E cursor, ordenação. Validado em PR-12. | **N/A** — só smoke E2E |
| **3B — GET /parcelas** | Handler OK, retorna `data` + `pagination`. UUID validado. Para título sem parcelas devolve `[]` (não 404). | **N/A** |
| **3C — POST /parcelas/sync** | **BUGS**: (1) handler usa `onConflict: 'id'` mas tabela `parcelas` **não tem UNIQUE** em `(conta_pagar_id, numero_parcela)` — re-envio sem `id` duplica; (2) spec envia `numero` mas coluna real é `numero_parcela` — vai falhar 400; (3) sem validação que `conta_pagar_id` existe — 23503 vira 500. | **FAZER** — fix 3 bugs |
| **3D — GET /pagamentos** | Handler OK, paginação cursor+offset. **Bug menor**: cursor `gt('id', cursor)` ordena por `id` (UUID, ordem arbitrária); mais correto seria por `data_pagamento` ou `created_at`. Mas funcional. | **N/A** (escopo Onda 4) |
| **3E — GET /anexos** | **BUG CRÍTICO**: handler consulta `payment_attachments` que **não existe**. Toda chamada retorna 500. Tabelas existentes: `documento_anexos`, `dynamic_form_attachments`, etc. — nenhuma é o destino correto. | **FAZER** — criar tabela `cp_anexos` + fix handler |
| **3F — POST /anexos** | Mesmo bug — insere em `payment_attachments` inexistente. | **FAZER** — usar `cp_anexos` |
| **3G — PUT /update** | Já tem validateReference para categoria + fornecedor (PR-13). Aceita `id` UUID. | **N/A** — só smoke E2E |

### Detalhe dos bugs

**3C — Parcelas sync**:
```
parcelas (real):                    parcela-handlers.ts (envia):
  id            uuid                  id           ← cliente NÃO envia (spec)
  numero_parcela int                  numero       ← coluna não existe
  valor          numeric              valor
  data_vencimento date                data_vencimento
  conta_pagar_id uuid (FK CASCADE)    conta_pagar_id

Sem UNIQUE(conta_pagar_id, numero_parcela) → onConflict='id' falha sem id; reenvio duplica.
```

**3E/3F — Anexos**:
```
Handler chama: payment_attachments (DOES NOT EXIST)
Tabelas reais: documento_anexos, projeto_tarefa_anexos, marketing_task_files... (nenhuma para CP).
```

## Plano de execução — PR-14 (v3.1.6)

### Fase A — Migration: schema dos avançados (BLOQUEANTE)

Migration SQL única:

1. **UNIQUE constraint em `parcelas`**: `ALTER TABLE parcelas ADD CONSTRAINT parcelas_conta_numero_uniq UNIQUE (conta_pagar_id, numero_parcela);` (depois de deduplicar se houver duplicatas — vou checar antes).

2. **Tabela nova `cp_anexos`**:
   ```sql
   CREATE TABLE public.cp_anexos (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     conta_pagar_id uuid NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
     nome_arquivo text NOT NULL,
     tipo text,
     url text,
     observacao text,
     source text DEFAULT 'api',
     created_at timestamptz DEFAULT now(),
     created_by uuid
   );
   CREATE INDEX cp_anexos_conta_pagar_id_idx ON cp_anexos(conta_pagar_id);
   ALTER TABLE cp_anexos ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "admin_full" ON cp_anexos FOR ALL USING (has_role(auth.uid(),'admin'));
   ```

### Fase B — Fix `parcela-handlers.ts`

`handleSyncParcelas`:
- Aceitar tanto `numero` quanto `numero_parcela` no input (alias).
- Validar que cada item tem `conta_pagar_id` UUID válido + `numero_parcela` + `valor` + `data_vencimento`.
- Pré-validar (em batch) que todos os `conta_pagar_id` existem; itens com FK inválido vão para `errosDetalhe[]`.
- Trocar `upsert(... onConflict: 'id')` por `upsert(... onConflict: 'conta_pagar_id,numero_parcela')`.
- Resposta: `{ success, processados, erros, errosDetalhe[] }` (mesmo padrão do upsert-lote).

### Fase C — Fix `anexo-handlers.ts`

- Trocar `payment_attachments` → `cp_anexos` em ambos handlers.
- Mapear campos: `payment_id`→`conta_pagar_id`, `file_name`→`nome_arquivo`, `file_type`→`tipo`, `file_url`→`url`, `notes`→`observacao`.
- `handleGetAnexos`: para título inexistente, devolver array vazio (não 404) — paridade com parcelas.
- `handlePostAnexos`: retornar 201 (estava devolvendo 200) com `{ success, anexo: { id, ... } }`.

### Fase D — Versionamento + regression + memória

- Bump `APP_VERSION` `3.1.5 → 3.1.6` em `src/lib/version.ts`.
- 5 invariantes novos em `audit/regression-greps.sh`:
  - `payment_attachments` ≤0 em handlers (regressão proibida).
  - `cp_anexos` ≥2 em `anexo-handlers.ts`.
  - `onConflict.*conta_pagar_id,numero_parcela` ≥1 em `parcela-handlers.ts`.
  - `numero_parcela` ≥1 em `parcela-handlers.ts` (não usar `numero` nu).
  - `errosDetalhe` ≥1 em `parcela-handlers.ts` (granularidade igual upsert-lote).
- Atualizar `docs/fixes-abr26/IMPLEMENTATION_REPORT.md` com seção PR-14 / Onda 3.
- Atualizar `mem://finance/contas-pagar-governance-and-audit-standard` adicionando: tabela `cp_anexos` para anexos de CP; `parcelas` tem UNIQUE em `(conta_pagar_id, numero_parcela)`.

### Fase E — Validação E2E

Smoke via `supabase--curl_edge_functions`:
1. `GET /query?status=pendente&limit=2` → 200, ≤2 registros, todos pendentes.
2. `GET /query?limit=2&offset=2` → 200, segunda página.
3. `GET /query?vencimento_de=2026-04-01&vencimento_ate=2026-04-30&order_by=valor_original&order_dir=desc` → 200 ordenado.
4. `GET /parcelas?conta_pagar_id=<uuid_real>` → 200 com array (vazio se sem parcelas).
5. `POST /parcelas/sync` 3 parcelas (`numero_parcela` 1/2/3) → 200, `processados:3`.
6. Reenviar mesmas 3 → 200, `processados:3` (sem duplicar — confirma UNIQUE+upsert).
7. `GET /parcelas?conta_pagar_id=...` → 200 com 3 itens.
8. `POST /parcelas/sync` com `conta_pagar_id` inexistente → `errosDetalhe[]` granular.
9. `GET /pagamentos?conta_pagar_id=<uuid_pago>` → 200 com pagamentos da Onda 2.
10. `GET /anexos?conta_pagar_id=<uuid>` → 200 array (não 500).
11. `POST /anexos` `{conta_pagar_id, nome_arquivo:'comprovante.pdf', tipo:'comprovante', url:'...'}` → 201 com `id`.
12. `GET /anexos?conta_pagar_id=...` → 200 com o anexo recém-inserido.
13. `PUT /update` `{id, valor_original: 999}` → 200.
14. `PUT /update` `{id, categoria_codigo: '99.99.99'}` → 400 "Categoria não encontrada".

## Não-escopo

- Trocar cursor de `pagamentos` para basear em `data_pagamento` (escopo Onda 4 se virar requisito).
- Migrar dados antigos para `cp_anexos` (tabela é nova; nada para migrar).
- Mudanças em telas frontend (regra explícita).
- SDK/OpenAPI bumps (sem mudança de contrato externo — só a tabela `cp_anexos` é interna).

## Impacto

3 arquivos editados (`anexo-handlers.ts`, `parcela-handlers.ts`, `version.ts`, `regression-greps.sh`) + 1 migration SQL (UNIQUE em parcelas + tabela `cp_anexos` com RLS). ~80 linhas mudadas. 5 invariantes novos. Bump de patch (`3.1.6`). Risco de regressão: muito baixo — fixes de schema drift puros + nova tabela isolada com RLS admin-only.

