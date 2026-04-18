

## Diagnóstico

Os logs do edge function revelam a **causa raiz exata** — não é falta de validação, é schema drift:

```
PGRST204: Could not find the 'codigo_categoria' column of 'contas_pagar' in the schema cache
```

O handler `handleUpsert` está tentando gravar a coluna `codigo_categoria`, mas a tabela real tem `categoria_codigo` (confirmado nas explorações da Onda 1: `contas_pagar.categoria_codigo` é varchar). O `handleIncluir` já mapeia corretamente para `categoria_codigo` (porque foi corrigido), mas o `handleUpsert` mantém o nome antigo.

Isso explica perfeitamente:
- `incluir` → 201 (mapping correto).
- `upsert` → 500 "Internal Server Error" (PostgREST devolve PGRST204, e o `runRouter` cai num fallback genérico que não preserva a mensagem do erro PGRST).

A spec do usuário pede 2 coisas adicionais legítimas:
1. **Validação de referências** em `handleUpsert` e `handleUpsertLote` (igual `handleIncluir`).
2. **Try/catch que devolva mensagem real** em vez de "Internal Server Error" genérico.

## Validação a fazer (read-only)

- Confirmar nome real da coluna em `contas_pagar` (`categoria_codigo` vs `codigo_categoria`).
- Ler `handleUpsert` e `handleUpsertLote` em `_shared/contas-pagar/crud-handlers.ts` para ver onde está o `codigo_categoria` e onde falta `validateReference`.
- Ler `runRouter` (em `contas-pagar-api/index.ts`) para confirmar onde a mensagem PGRST está sendo perdida.

## Plano de execução — PR-12 (v3.1.4)

### Fase A — Fix de schema drift no upsert (causa raiz do 500)

**`_shared/contas-pagar/crud-handlers.ts` → `handleUpsert`**

- Trocar `codigo_categoria` por `categoria_codigo` no payload do `.upsert()` (igual já está em `handleIncluir`).
- Aplicar mesmo fix em `handleUpsertLote` (loop interno).

### Fase B — Validação de referências no upsert (paridade com incluir)

**`handleUpsert`**: após Zod parse, antes do `.upsert()`, chamar `validateReference` para:
- Categoria (`trade_chart_of_accounts.code`) — obrigatória.
- Fornecedor (`fornecedores.erp_code`) — se `codigo_cliente_fornecedor` foi fornecido.
- Empresa (`empresas.id`) — se `empresa_id` foi fornecido.

**`handleUpsertLote`**: validar por item dentro do loop. Se item falha validação, marca como erro daquele item (não aborta o lote inteiro) — registra em `resultados[]` com `codigo_status:"1"` e `descricao_status` específico.

### Fase C — Mensagem de erro real (anti "Internal Server Error" genérico)

**`contas-pagar-api/index.ts` → `runRouter`** (já existe try/catch mas perde detalhes do PostgREST):
- Garantir que erros PGRST (`PGRST204`, `PGRST116`, etc.) tenham `error.message` exposta no body de resposta.
- Não retornar `"Internal Server Error"` literal — sempre body JSON com `codigo_status:"1"` + `descricao_status` contendo a mensagem real.
- Padrão já existe para 22P02/23503/23505 no `mapPgError` — estender para PGRST*.

### Fase D — Versionamento + regression

- Bump `APP_VERSION` `3.1.3 → 3.1.4` em `src/lib/version.ts`.
- Adicionar 4 invariantes em `audit/regression-greps.sh`:
  - `grep -c "codigo_categoria" supabase/functions/_shared/contas-pagar/crud-handlers.ts` == 0 (sem schema drift).
  - `grep -c "categoria_codigo" supabase/functions/_shared/contas-pagar/crud-handlers.ts` ≥ 2 (incluir + upsert).
  - `validateReference.*categoria` aparece em `handleUpsert` (≥1).
  - `Internal Server Error` literal nunca aparece em handlers (≥0 em handlers, só em fallback final do middleware).
- Atualizar `docs/fixes-abr26/IMPLEMENTATION_REPORT.md` com seção PR-12.

### Fase E — Validação E2E

- Deploy `contas-pagar-api` via `supabase--deploy_edge_functions`.
- Smoke via `supabase--curl_edge_functions`:
  1. `POST /upsert` com payload do usuário → deve retornar 200/201 com sucesso (categoria 2.1.1 existe, fornecedor erp_code 12345 do Perez existe, empresa 5 existe).
  2. `POST /upsert` com `codigo_categoria:"99.99.99"` → 400 "Categoria não encontrada".
  3. `POST /upsert` sem `categoria_codigo` válido → 400 estruturado, não 500 genérico.
  4. `POST /upsert-lote` com 2 itens (1 ok, 1 com fornecedor inexistente) → 200 com `total_processados:1, total_erros:1`.

## Não-escopo

- Renomear coluna `categoria_codigo` para `codigo_categoria` no banco (breaking change, requer migração de 48k+ registros).
- Mudanças em `handleIncluir` (já está correto).
- SDK bump (sem mudança de contrato externo).

## Impacto

3 arquivos editados (~40 linhas), 4 invariantes novos, 1 patch bump. Risco de regressão: baixo (só corrige bug e adiciona validação simétrica). Resolve o 500 do upsert, garante paridade com incluir, expõe mensagem real em qualquer falha futura.

