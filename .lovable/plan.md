

## Filtrar Aprovações por Filial no Módulo Financeiro e Trade

### Situação Atual

| Tabela | Tem `empresa_id` | RLS com filtro empresa | Status |
|---|---|---|---|
| `contas_pagar` | ✅ | ✅ | OK |
| `contas_receber` | ✅ | ✅ | OK |
| `financial_payment_queue` | ✅ | ✅ | OK |
| `bank_connections` | ✅ | ✅ | OK |
| `conciliacoes_bancarias` | via FK | ✅ | OK |
| `trade_financial_entries` | ✅ | ❌ | **Precisa atualizar RLS** |
| `trade_campaigns` | ❌ | ❌ | **Precisa adicionar coluna + RLS** |
| `trade_investments` | ❌ | ❌ | **Precisa adicionar coluna + RLS** |

### Mudanças

#### 1. Migração SQL

**Adicionar `empresa_id` nas tabelas que faltam:**
```sql
ALTER TABLE trade_campaigns 
  ADD COLUMN empresa_id INTEGER REFERENCES empresas(id);

ALTER TABLE trade_investments 
  ADD COLUMN empresa_id INTEGER REFERENCES empresas(id);
```

**Atualizar RLS de `trade_financial_entries`:**
```sql
DROP POLICY IF EXISTS "tfe_select" ON trade_financial_entries;
CREATE POLICY "tfe_select_empresa" ON trade_financial_entries
FOR SELECT TO authenticated
USING (
  (created_by = auth.uid() OR check_user_access(auth.uid(), 'trade'))
  AND user_has_empresa_access(auth.uid(), empresa_id)
);
-- Mesma lógica para UPDATE e DELETE
```

**Adicionar RLS de empresa em `trade_campaigns`:**
```sql
DROP POLICY IF EXISTS "trade_campaigns_user_select" ON trade_campaigns;
CREATE POLICY "tc_select_empresa" ON trade_campaigns
FOR SELECT TO authenticated
USING (
  (responsible_user_id = auth.uid() OR created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
  AND user_has_empresa_access(auth.uid(), empresa_id)
);
```

**Adicionar RLS de empresa em `trade_investments`:**
```sql
DROP POLICY IF EXISTS "ti_select" ON trade_investments;
CREATE POLICY "ti_select_empresa" ON trade_investments
FOR SELECT TO authenticated
USING (
  (vendedor_id = auth.uid() OR created_by = auth.uid() OR check_user_access(auth.uid(), 'trade'))
  AND user_has_empresa_access(auth.uid(), empresa_id)
);
```

Dados legados (com `empresa_id = NULL`) continuam acessíveis — a função `user_has_empresa_access` já trata esse caso.

#### 2. Sem mudanças no frontend

Os hooks `usePendingCampaigns`, `usePendingFinancialEntries` e `usePendingInvestments` já fazem queries diretas ao banco. O RLS garante que o banco retorna apenas dados das filiais autorizadas automaticamente, sem necessidade de filtros adicionais no frontend.

### Impacto
- Funcionários vinculados a uma filial verão apenas campanhas, lançamentos e investimentos dessa filial nos centros de aprovação
- Admins e supervisores mantêm visão global
- Registros criados antes da mudança (sem `empresa_id`) continuam visíveis

