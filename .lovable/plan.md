

# Migração: Manter Descrição Original e Seguir Sequência do Cliente

## Problema

Na tabela de migração, as contas novas (v2) estão com nomes diferentes das contas antigas. Exemplo:
- `3.4.04 IRPJ` → `2.5.3 COFINS/CSLL/PIS/IRPJ` (nome mudou)
- `1100 Material POP` → `2.6.2 Despesas de Trade Comercial` (nome genérico)

O correto é manter a **mesma descrição da conta antiga** e apenas trocar o código numérico para a sequência do novo plano (v2).

## Solução

### 1. Migração SQL — Atualizar `plano_contas_migracao`

Atualizar todos os registros para que `new_name = old_name`:

```sql
UPDATE plano_contas_migracao
SET new_name = old_name
WHERE new_name != old_name;
```

### 2. Migração SQL — Atualizar contas v2 em `trade_chart_of_accounts`

Para cada mapeamento, atualizar o nome da conta v2 correspondente para refletir o nome original:

```sql
UPDATE trade_chart_of_accounts t
SET name = m.old_name
FROM plano_contas_migracao m
WHERE t.id = m.new_account_id
  AND t.name != m.old_name;
```

> Nota: Contas v2 que são mapeadas por múltiplas contas antigas (ex: `2.6.2` recebe tanto `Material POP` quanto `Promotores`) terão o nome da última atualização. Se houver conflitos, o dropdown na interface permite ajustar manualmente.

### Resultado

| Antes | Depois |
|---|---|
| `3.4.04 IRPJ → 2.5.3 COFINS/CSLL/PIS/IRPJ` | `3.4.04 IRPJ → 2.5.3 IRPJ` |
| `1100 Material POP → 2.6.2 Despesas de Trade Comercial` | `1100 Material POP → 2.6.2 Material POP` |

## Arquivo

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | UPDATE em `plano_contas_migracao` e `trade_chart_of_accounts` |

