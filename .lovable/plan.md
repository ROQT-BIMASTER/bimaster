

## Plano: Corrigir Análise de Espaço em Branco

### Problema Raiz

Todas as 4 funções RPC do Whitespace estão com `search_path=""` (vazio) no banco de dados. Isso faz com que referências a tabelas como `clientes`, `ibge_municipios` etc. falhem com erro `relation "clientes" does not exist` (HTTP 404).

Adicionalmente, a função `fn_get_whitespace_kpi_details` referencia colunas que não existem na tabela `ibge_municipios`:
- `m.uf` (correto: `m.uf_sigla`)
- `m.populacao` (correto: `m.populacao_estimada`)

### Correção

Uma única migração SQL para recriar as 4 funções com `SET search_path TO 'public'` (formato correto que persiste):

1. **`fn_get_whitespace_kpis`** — recriar com `SET search_path TO 'public'`
2. **`fn_get_whitespace_analysis`** — recriar com `SET search_path TO 'public'`
3. **`fn_get_whitespace_top_microrregioes`** — recriar com `SET search_path TO 'public'`
4. **`fn_get_whitespace_kpi_details`** — recriar com `SET search_path TO 'public'` + corrigir `m.uf` → `m.uf_sigla` e `m.populacao` → `m.populacao_estimada`

Nenhum arquivo de código frontend precisa mudar — o problema é exclusivamente no banco de dados.

### Impacto
- KPIs, tabela, gráfico e detalhes do Whitespace voltarão a funcionar
- Sem impacto em outras funcionalidades

