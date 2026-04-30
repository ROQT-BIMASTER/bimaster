## Diagnóstico

A imagem que você enviou descreve a estrutura hierárquica do produto raiz **3213 (CX BATOM VELVETY GLASS)**:

```text
Pai (CX) 3213
├─ Mãe (BX) 3215 ─ qtd 4 → Filho (UN) 3216 ─ qtd 12
├─ Mãe (BX) 3217 ─ qtd 4 → Filho (UN) 3218 ─ qtd 12
├─ Mãe (BX) 3219 ─ qtd 4 → Filho (UN) 3220 ─ qtd 12
├─ ... (8 mães diferentes, BG01..BG08)
└─ Mãe (BX) 3229 ─ qtd 4 → Filho (UN) 3230 ─ qtd 12

1 CX = 8 BX-tipos × 4 BX-físicas × 12 UN = 32 BX × 12 UN = 384 UN
```

A **BOM no banco já está correta** (tabela `bom_edges` e view `vw_bom_path` retornam exatamente esses caminhos). O problema está na função `refresh_estoque_unificado_cache()` que popula `estoque_unificado_cache` (lida pelo `vw_estoque_unificado` e pelo hook `useEstoqueUnificado`):

- Hoje calcula `fator_cx_para_un = MAX(fator_acumulado)` de uma folha → retorna **48** (uma sub-árvore)
- Correto: **soma dos `fator_acumulado` de todas as folhas UN sob a raiz** → **384**

Essa distorção zera quando o produto-raiz tem só uma sub-árvore (caso simples 1 CX = N BX iguais), mas quebra para sortimentos como 3213.

## O que será feito

### 1. Migration — corrigir fórmula dos fatores

Reescrever a função `refresh_estoque_unificado_cache()` na CTE `fatores`:

- **`fator_cx_para_un`**: `SUM(p.fator_acumulado)` de todas as folhas UN (`nivel = 3`) sob a raiz
- **`fator_bx_para_un`**: `SUM(p.fator_acumulado / quantidade_da_mae)` agrupado, OU média ponderada por mãe, calculada como `SUM(folha_un) / COUNT(distinct mãe)` — define UN equivalente médio por BX quando o sortimento for heterogêneo

Também vou ajustar `saldo_total_em_unidades` mantendo `MAX` apenas na ausência de caminho (folha órfã). Quando houver múltiplos caminhos para a mesma folha (não é o caso desse exemplo, mas existe na base), usar `LATERAL` com `DISTINCT ON (folha_cod)` para evitar duplicação.

### 2. Recalcular cache retroativo

Executar `SELECT public.refresh_estoque_unificado_cache();` na própria migration para recompor as 3.267 linhas atuais imediatamente, com os fatores corretos.

### 3. Garantir sync automático com ERP Huggs

Verificar/ativar o gatilho de refresh do cache após cada sincronização (já existe `estoque_sync_logs`). Se não houver trigger automático após a sync de `erp_estoque_distribuidora` e `bom_edges`, adicionar chamada `refresh_estoque_unificado_cache()` ao fim do edge function de sincronização do ERP Huggs.

### 4. Frontend — refletir nova realidade

- `EstoqueUnificadoKpis.tsx` e `EstoqueUnificadoPage.tsx`: nenhum ajuste de UI necessário, os componentes já consomem `fator_cx_para_un` / `fator_bx_para_un` da view. A correção do cache propaga sozinha.
- Adicionar **tooltip explicativo** ao lado do valor "Equivalente em UN" mostrando a fórmula `Σ folhas (qtd_pai_mãe × qtd_mãe_filho)` com a quantidade de sub-árvores agregadas, para que o usuário entenda que produtos com sortimento têm fator > soma simples.
- No detalhamento (futuro modal "Ver composição"): listar as folhas e o fator de cada caminho.

### 5. Validação pós-deploy

Conferir que o produto-raiz **3213** passa a exibir:

- `fator_cx_para_un = 384`
- `saldo_em_caixas × 384 + saldo_em_displays × 12 + saldo_em_unidades = saldo_total_em_unidades` (aprox., respeitando sortimento)

E checar 5–10 outros produtos-raiz para garantir que casos simples (1 mãe → 1 folha) continuam corretos.

### 6. Versionamento e changelog

- Bump `APP_VERSION` para **3.4.49**
- Entrada no changelog de `ApiDocumentation.tsx`: "Estoque Unificado: corrigido cálculo de UN equivalente para produtos com sortimento hierárquico (Pai/Mãe/Filho)"

## Detalhes técnicos

### Fórmula proposta (SQL)

```sql
fatores AS (
  SELECT a.empresa, a.produto_raiz,
    -- Soma de todas as folhas UN sob a raiz
    COALESCE((
      SELECT SUM(sub.fator_un)
      FROM (
        SELECT DISTINCT ON (p.folha_cod) p.folha_cod, p.fator_acumulado AS fator_un
        FROM public.vw_bom_path p
        JOIN public.estoque_produto_nivel nf
          ON nf.cod_produto = p.folha_cod AND nf.nivel = 3
        WHERE p.raiz_cod = a.produto_raiz
        ORDER BY p.folha_cod, p.profundidade DESC
      ) sub
    ), 1) AS fator_cx_para_un,
    -- BX → UN: média ponderada (UN total ÷ qtd de BX-tipos)
    COALESCE((
      SELECT SUM(sub.fator_un) / NULLIF(COUNT(DISTINCT sub.mae_cod), 0)
      FROM (
        SELECT DISTINCT ON (p.folha_cod)
          p.folha_cod, p.fator_acumulado AS fator_un,
          p.caminho[2] AS mae_cod  -- 2º elemento = mãe (nivel 2)
        FROM public.vw_bom_path p
        JOIN public.estoque_produto_nivel nf
          ON nf.cod_produto = p.folha_cod AND nf.nivel = 3
        WHERE p.raiz_cod = a.produto_raiz AND p.profundidade >= 2
        ORDER BY p.folha_cod, p.profundidade DESC
      ) sub
    ), 1) AS fator_bx_para_un
  FROM agg a
)
```

### Arquivos afetados

- `supabase/migrations/<timestamp>_fix_estoque_unificado_fatores.sql` (novo)
- `src/components/estoque/unificado/EstoqueUnificadoKpis.tsx` (tooltip)
- `src/lib/version.ts` (bump 3.4.49)
- `src/components/erp/ApiDocumentation.tsx` (changelog)

Sem alteração em `useEstoqueUnificado.ts`, `modoExibicao.ts` ou tipos — eles já estão corretos, é só a origem dos dados que estava errada.

### Risco

Baixo. A migration apenas substitui a função e roda o refresh, que já é idempotente (`TRUNCATE` + `INSERT`). Caso algum produto perca dados de BOM no futuro, o `COALESCE(..., 1)` mantém comportamento legado (fator = 1).

## Pronto para implementar?

Ao aprovar, executo a migration, recalculo o cache, ajusto o tooltip dos KPIs e bumpo a versão.