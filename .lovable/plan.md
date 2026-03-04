

## Excluir Despesas de Teste do Banco de Dados

Identifiquei os dois registros de teste na tabela `trade_financial_entries`:

| ID | Descrição | Valor | Data |
|---|---|---|---|
| `d0c14f3f-...` | teste 01 | R$ 1.000,00 | 10/02/2026 |
| `ccf538b1-...` | ;;. | R$ 3.000,00 | 02/02/2026 |

### Ação

Executar uma migração SQL para deletar esses dois registros específicos pelo ID:

```sql
DELETE FROM trade_financial_entries 
WHERE id IN (
  'd0c14f3f-4dc5-4516-8e70-493a66421e7a',
  'ccf538b1-09e0-405d-afe6-25b4fdb50bf9'
);
```

Nenhum arquivo de código será alterado.

