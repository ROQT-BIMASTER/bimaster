

# PR-25 — Eliminar NULLs de relacionamento na API CP

## Diagnóstico (verificado em produção)

**O problema do usuário é real, mas localizado:** de 48.299 títulos, **55 têm `empresa_nome` NULL** e **50 têm `categoria_nome` NULL** (~0,1% do total). Fornecedor e departamento estão 100% preenchidos no cache.

**Causa raiz dupla:**

1. **Cache denormalizado não preenchido na escrita.** Os handlers `handleIncluir` / `handleUpsert` / `handleUpsertLote` aceitam `empresa_id` e `codigo_categoria`, validam que existem, mas **nunca buscam e gravam** `empresa_nome` / `categoria_nome` na linha. Resultado: títulos criados via API (`API-TEST-NUMERIC-…`, `a1b2c3d4-…`) ficam com cache vazio para sempre. Linhas vindas do sync legado (com `data_hash`) já trazem o nome embutido — por isso só ~100 linhas estão afetadas, todas de origem API.

2. **`shapeMetaRelacionados` não tem fallback ao vivo.** A função monta `meta_relacionados` lendo apenas as colunas cache (`row.empresa_nome`, `row.categoria_nome`). Se o cache está NULL, o meta retorna NULL — mesmo com os dados disponíveis em `empresas` e `trade_chart_of_accounts`.

**Não é problema de JOIN faltando** no sentido literal: as tabelas existem (`empresas`, `trade_chart_of_accounts.code/.name`, `fornecedores.codigo_externo/.razao_social`, `departamentos`) e os dados estão lá. É **estratégia de leitura inadequada quando o cache falha**.

**Não-bug confirmado:** `categoria_nome="COMPRA DE MERCADORIA PARA REVENDA"` no exemplo do usuário não bate com `trade_chart_of_accounts.code='1'` que é "RECEITA BRUTA" — significa que o cache antigo guarda nomes do ERP externo (Omie) que não existem mais aqui. Vamos respeitar o cache quando existe; só preencher quando NULL.

## Plano de correção

### Fase 1 — Backfill histórico (1 migration, idempotente)

Atualizar as ~105 linhas afetadas com `UPDATE … FROM` em 3 statements:

```sql
-- empresa_nome
UPDATE contas_pagar cp
SET empresa_nome = e.nome
FROM empresas e
WHERE cp.empresa_id = e.id AND cp.empresa_nome IS NULL;

-- categoria_nome (via trade_chart_of_accounts)
UPDATE contas_pagar cp
SET categoria_nome = t.name
FROM trade_chart_of_accounts t
WHERE cp.categoria_codigo = t.code AND cp.categoria_nome IS NULL;

-- fornecedor_nome (preventivo, mesmo padrão)
UPDATE contas_pagar cp
SET fornecedor_nome = f.razao_social
FROM fornecedores f
WHERE cp.fornecedor_codigo = f.codigo_externo AND cp.fornecedor_nome IS NULL;
```

**Impacto:** ~105 UPDATEs, sem bloqueio (linhas isoladas), reversível por estar restrito a `IS NULL`.

### Fase 2 — Backfill automático na escrita (`crud-handlers.ts`)

Criar helper `enrichCachedNames(supabase, payload)` que, antes de cada INSERT/UPDATE, faz lookup paralelo das 3 dimensões quando o nome não veio no payload:

```ts
async function enrichCachedNames(supabase, p) {
  const [emp, cat, forn] = await Promise.all([
    p.empresa_id && !p.empresa_nome
      ? supabase.from('empresas').select('nome').eq('id', p.empresa_id).maybeSingle()
      : null,
    (p.codigo_categoria ?? p.categoria_codigo) && !p.categoria_nome
      ? supabase.from('trade_chart_of_accounts').select('name').eq('code', String(p.codigo_categoria ?? p.categoria_codigo)).maybeSingle()
      : null,
    (p.codigo_cliente_fornecedor ?? p.fornecedor_codigo) && !p.fornecedor_nome
      ? supabase.from('fornecedores').select('razao_social').eq('codigo_externo', String(p.codigo_cliente_fornecedor ?? p.fornecedor_codigo)).maybeSingle()
      : null,
  ]);
  return {
    ...p,
    ...(emp?.data?.nome && { empresa_nome: emp.data.nome }),
    ...(cat?.data?.name && { categoria_nome: cat.data.name }),
    ...(forn?.data?.razao_social && { fornecedor_nome: forn.data.razao_social }),
  };
}
```

Aplicar em: `handleIncluir`, `handleUpsert`, `handleUpdate`, e dentro do loop de `handleUpsertLote` (1 chamada paralela por item, mantendo o batch). Custo: +3 queries por escrita single (~30ms) ou +0 quando o cliente já mandou os nomes.

### Fase 3 — Fallback ao vivo na leitura (`shapeMetaRelacionados`)

Em `handleQuery` e `handleConsultar`, quando há rows com cache NULL, fazer **um único batch lookup** das dimensões faltantes e injetar antes do `shapeMetaRelacionados`:

```ts
// após o select principal
const empresaIdsFaltando = [...new Set(data.filter(r => r.empresa_id && !r.empresa_nome).map(r => r.empresa_id))];
const catCodesFaltando   = [...new Set(data.filter(r => r.categoria_codigo && !r.categoria_nome).map(r => r.categoria_codigo))];
const fornCodesFaltando  = [...new Set(data.filter(r => r.fornecedor_codigo && !r.fornecedor_nome).map(r => r.fornecedor_codigo))];

const [empMap, catMap, fornMap] = await Promise.all([
  empresaIdsFaltando.length ? buildMap(supabase, 'empresas', 'id', 'nome', empresaIdsFaltando) : new Map(),
  catCodesFaltando.length   ? buildMap(supabase, 'trade_chart_of_accounts', 'code', 'name', catCodesFaltando) : new Map(),
  fornCodesFaltando.length  ? buildMap(supabase, 'fornecedores', 'codigo_externo', 'razao_social', fornCodesFaltando) : new Map(),
]);

const enriched = data.map(r => shapeMetaRelacionados({
  ...r,
  empresa_nome: r.empresa_nome ?? empMap.get(r.empresa_id) ?? null,
  categoria_nome: r.categoria_nome ?? catMap.get(r.categoria_codigo) ?? null,
  fornecedor_nome: r.fornecedor_nome ?? fornMap.get(r.fornecedor_codigo) ?? null,
}));
```

**Custo:** 0 a 3 queries extras por GET, executadas em paralelo, com chaves únicas (`Set`). Em respostas grandes (limit=100), ainda ≤3 queries totais. Defesa em profundidade contra qualquer cache stale futuro.

### Fase 4 — Versionamento e regression

- **APP** 3.2.1 → **3.2.2** (patch — bug fix de NULL em meta_relacionados, sem mudança de contrato).
- **OpenAPI / SDK:** sem bump (resposta apenas deixa de retornar NULL onde havia dado disponível — não-quebrante).
- Adicionar 3 invariantes em `audit/regression-greps.sh`:
  - `enrichCachedNames` em `crud-handlers.ts` ≥1 (backfill na escrita)
  - `empresaIdsFaltando|empMap.get` em `crud-handlers.ts` ≥1 (fallback na leitura)
  - `trade_chart_of_accounts` em `crud-handlers.ts` ≥2 (validação + lookup)
- Changelog inline em `ApiDocumentation.tsx`.

### Fase 5 — Smoke

1. POST `/incluir` com `empresa_id=5, codigo_categoria='2.1.1', codigo_cliente_fornecedor='3'` sem nomes → confirmar que título gravado já tem cache populado.
2. GET `/query?limit=200` em página com mistura de cache vazio e cheio → todos `meta_relacionados` populados quando dado existe.
3. Rerodar query de auditoria: `empresa_backfill_needed=0`, `cat_backfill_needed=0`.

## Não-escopo

- Não tocar nas 6 telas React proibidas.
- Não alterar `categoria_nome` quando o cache existe e diverge do `trade_chart_of_accounts` atual (cache reflete fonte original Omie — preservar histórico).
- Não unificar `categoria_codigo` ↔ `plano_contas_codigo` (são dois sistemas paralelos por design).
- `portador` e `projeto` continuam via JOIN (já funcionam corretamente).

## Impacto estimado

**Arquivos:** `crud-handlers.ts` (~80 linhas — helper + 4 chamadas + fallback batch em `handleQuery`/`handleConsultar`), `audit/regression-greps.sh` (+3 invariantes), `version.ts` (1 linha), `ApiDocumentation.tsx` (changelog). **+1 migration** (3 UPDATEs idempotentes).

**Risco:** baixo. Backfill é restrito a `IS NULL`; lookups novos têm fallback silencioso (`.maybeSingle()`) e nunca bloqueiam escrita; payload de saída só ganha campos onde antes era NULL.

