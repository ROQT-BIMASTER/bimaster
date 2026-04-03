

# Apagar Todo o Plano de Contas

## Situação Atual

- **391 contas** em `trade_chart_of_accounts`
- **181 registros** em `plano_contas_migracao`
- **47.497 contas a pagar** com `plano_contas_id` vinculado — esses vínculos serão removidos (setados para NULL)
- **0 contas a receber** vinculadas

## Ações

### 1. Migração SQL

Executar em sequência:

1. **Desvincular contas a pagar** — `UPDATE contas_pagar SET plano_contas_id = NULL, plano_contas_codigo = NULL, plano_contas_nome = NULL`
2. **Limpar tabela de migração** — `DELETE FROM plano_contas_migracao`
3. **Limpar plano de contas** — `DELETE FROM trade_chart_of_accounts`

Após isso, a tela do Plano de Contas ficará vazia, pronta para receber a nova estrutura.

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Desvincular contas a pagar + deletar migração + deletar plano de contas |

