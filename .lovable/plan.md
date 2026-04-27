## Diagnóstico

A engine `sync-vendas-*` está falhando com `SQL query failed: Invalid column name 'Cod Produto'` em todas as execuções (Sync Full, Incremental e por Empresa). Inspeção da view real `ConsultaPowerBI` no SQL Server (via `/preview-table`) revelou que os nomes das colunas usam ponto e capitalização diferentes do que foi assumido no código.

### Mapa de divergências confirmado

| Código atual (errado) | Nome real na view ConsultaPowerBI |
|---|---|
| `Cod Produto` | `Cod.Produto` |
| `Cod Cliente` | `Cod.Cliente` |
| `Cod Vend` | `Cod.Vend` |
| `Cod Equipe` | `Cod.Equipe` |
| `ID Ramo` | `IDRAMO` |
| `Operacao` | `Operação` |
| `Tp Venda` | `TP VENDA` |
| `Tp NFe` | `TP NFE` |
| `Descricao` | `Descrição` |
| `Preco Venda` | `Preço` |
| `Vl Desconto` | `Vl.Desconto` |
| `Vl ICM Subst` | `Vl.Icm Subst.` |
| `Vl CMV` | `Vl.CMV` |
| `Vl Outros Custos` | `Vl.Outros custos` |
| `Nome Linha` | `NomeLinha` |

Bônus: a view já entrega a coluna `Venda` calculada — vamos preferir esse valor em vez de recalcular `quantidade * preço − desconto` (evita divergência com o ERP).

## Mudanças

### 1. `supabase/functions/erp-sync-engine/index.ts`

- **`transformVendas()`** (linhas 224–271): substituir todos os acessos `row["..."]` pelos nomes corretos da view conforme tabela acima. Manter aliases de fallback (`row["Operacao"]`, `row["Descricao"]`, `row["Preco"]`) para tolerância caso a view seja alterada.
- **Cálculo de venda**: usar `row["Venda"]` quando presente; cair no cálculo manual apenas se vier zero/nulo.
- **`VENDAS_ORDER_BY`** (linha 903): trocar `[Cod Produto]` por `[Cod.Produto]` no ORDER BY.

### 2. Validação imediata

- Redeployar a edge function `erp-sync-engine`.
- Disparar um teste rápido via `/sync-vendas-por-empresa` com `empresa_id=1` (RUBY ROSE-SP) e checar logs/painel.
- Se OK, o cron diário das 06:15 e o botão "Sync Full (≥ 2025)" passam a funcionar sem alteração adicional.

### 3. Sem mudanças necessárias em

- Schema do banco (`public."Union"` já tem todas as colunas em `snake_case`).
- Frontend (`VendasSyncPanel`, `useVendasSync`).
- Cron job (já agendado).

## Critério de sucesso

- Painel "Histórico de Sincronizações" passa a mostrar status `success` com `Total > 0` e `Inseridos > 0`.
- Tabela `public."Union"` recebe registros com `sincronizado_em` recente e `erp_id` único.
