## Problema confirmado

A tabela do **Estoque Unificado** mostra "Carregando…" indefinidamente porque a view `vw_estoque_unificado` está demorando **~7,9 s** apenas para retornar 50 linhas (medido via `EXPLAIN ANALYZE`). Com o parâmetro `count: 'exact'` usado pelo hook, o PostgREST precisa rodar a view **duas vezes** (uma para os dados, outra para contar), ultrapassando o timeout padrão do gateway HTTP — a requisição é abortada antes de chegar ao navegador.

A última migração (que adicionou `fator_cx_para_un`, `fator_bx_para_un`, `ean_raiz`) agravou um problema que já existia: a view tem CTE recursiva (`bom_path`) sendo recalculada por linha + `Nested Loop` contra `fabrica_produtos` sem índice de junção apropriado.

```text
Plano atual: 7.899 ms para 50 linhas (167.610 buffers)
  → Nested Loop Left Join com fabrica_produtos: 88.296 linhas removidas pelo filtro
  → CTE path recursiva: avaliada 9.878 vezes
```

## Solução

Trocar a view por uma **tabela materializada** mantida pela mesma RPC `recalcular_estoque_niveis()` que já é chamada pelo botão "Recalcular níveis" e pelo cron de sincronia ERP. Leitura passa a ser instantânea (índice por empresa + produto_raiz).

### Backend (uma migração)

1. Criar tabela `estoque_unificado_cache`:
   - PK composta `(empresa, produto_raiz)`
   - Colunas: `saldo_em_caixas`, `saldo_em_displays`, `saldo_em_unidades`, `saldo_total_em_unidades`, `custo_total`, `skus_envolvidos`, `fator_cx_para_un`, `fator_bx_para_un`, `ean_raiz`, `atualizado_em`
   - Índices: `(empresa)`, `(saldo_total_em_unidades DESC)`, `(custo_total DESC)`
   - RLS: `SELECT` para `authenticated` (já é dado consolidado, mesmo padrão atual da view)

2. Criar função `refresh_estoque_unificado_cache()` (`SECURITY DEFINER`) que faz `TRUNCATE + INSERT` a partir da query atual da view (executada uma única vez, em background).

3. Alterar `recalcular_estoque_niveis()` para chamar `refresh_estoque_unificado_cache()` no final, garantindo que toda recalculação de níveis também atualize o cache.

4. Substituir a view `vw_estoque_unificado` por uma view trivial `SELECT * FROM estoque_unificado_cache` (mantém compatibilidade com o frontend e com o KPI Drift, sem precisar mexer em tipos gerados).

5. Popular o cache imediatamente na própria migração (`SELECT refresh_estoque_unificado_cache();`).

### Frontend (ajuste defensivo no hook)

Em `src/hooks/estoque/useEstoqueUnificado.ts`:
- Trocar `count: 'exact'` por `count: 'estimated'` (ou fazer um `select('produto_raiz', { count: 'exact', head: true })` separado em paralelo). Isso evita a dupla varredura mesmo no novo cache.
- Adicionar tratamento de erro visível: quando `error` voltar do Supabase, mostrar `toast.error()` na página em vez de ficar preso em "Carregando…".

### Manutenção

- Bump `APP_VERSION` para `3.4.46` em `src/lib/version.ts`.
- Adicionar entrada de changelog em `src/components/erp/ApiDocumentation.tsx` descrevendo a materialização e a correção do timeout.

## Resultado esperado

- Carregamento da página em < 200 ms (consulta indexada em tabela física).
- Botão "Recalcular níveis" continua sendo a única forma de atualizar o cache (já é o fluxo atual).
- Toggle Físico/CX/BX/UN segue funcionando porque os fatores ficam armazenados em coluna.
- Nenhuma mudança visual; apenas a tabela passa a popular.
