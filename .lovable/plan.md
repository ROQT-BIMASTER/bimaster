
# Plano de Otimização de Performance do Sistema

## Diagnóstico: Problemas Identificados

### 1. CRÍTICO: Tabelas com Volume Excessivo de Dados

| Tabela | Registros | Tamanho | Problema |
|--------|-----------|---------|----------|
| `audit_logs` | **28.4 milhões** | **7.8 GB** | Logs de auditoria sem política de retenção |
| `sync_control` | **1.57 milhões** | **279 MB** | Histórico de sincronização acumulado |
| `contas_receber` | 394.579 | 409 MB | Volume alto mas esperado |
| `contas_pagar` | 43.900 | 186 MB | Volume normal |

A tabela `audit_logs` está consumindo **7.8 GB** de espaço e provavelmente causando lentidão em operações que disparam triggers de auditoria.

### 2. Padrões de Código Ineficientes

**A) Fetches manuais em vez de `useQuery`**
- `TradeFinanceiro.tsx` - Busca manual de budgets, accounts, investments
- `TradeCampaigns.tsx` - Busca manual de campaigns, budgets, stores
- `TradeVerbasSemestrais.tsx` - Busca manual de budgets e accounts
- `TaskDashboard.tsx` - Busca manual de atividades
- `TradeAprovacoes.tsx` - Busca manual de financial entries

Estes componentes **não aproveitam cache** do React Query.

**B) Invalidação agressiva de cache**
- `ContasAReceber.tsx` invalida **10+ query keys** ao montar
- Força recarga completa de Dashboard, Tabela e Calendário toda vez

**C) Cache desabilitado intencionalmente**
- `DREAnalitico.tsx` usa `staleTime: 0` e `gcTime: 0`
- Garante dados frescos mas **elimina qualquer benefício de cache**

### 3. Queries Paralelas Excessivas

O módulo financeiro carrega **todos os dados** (300k+ registros) em paralelo:
- `useFluxoCaixaData.ts` faz batches de 1000 registros com 8 requisições simultâneas
- Em desktop com boa conexão, isso ainda pode ser lento devido ao volume

### 4. Índices Não Utilizados

Encontrados **25 índices com zero scans**, incluindo:
- `idx_bank_transactions_date`
- `idx_trade_financial_entries_account`
- `idx_approvals_approver`
- `idx_mv_trade_performance_mes`

Índices ocupam espaço e podem desacelerar INSERTs/UPDATEs.

---

## Plano de Ação: Otimizações

### Fase 1: Limpeza do Banco de Dados (Impacto Alto)

**1.1 Criar política de retenção para `audit_logs`**

Implementar particionamento por data e remoção de logs antigos (manter apenas 90 dias).

```sql
-- Criar tabela de arquivo para logs antigos
CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING ALL);

-- Mover logs com mais de 90 dias para arquivo
INSERT INTO audit_logs_archive 
SELECT * FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Deletar logs antigos da tabela principal
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Criar índice parcial para logs recentes
CREATE INDEX CONCURRENTLY idx_audit_logs_recent 
ON audit_logs (created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';
```

**1.2 Limpar tabela `sync_control`**

```sql
-- Manter apenas os últimos 1000 registros por entidade
DELETE FROM sync_control 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY entidade ORDER BY created_at DESC) as rn
    FROM sync_control
  ) t WHERE rn <= 1000
);
```

**1.3 Remover índices não utilizados**

```sql
-- Remover índices com zero scans (após verificação manual)
DROP INDEX IF EXISTS idx_bank_transactions_date;
DROP INDEX IF EXISTS idx_trade_financial_entries_account;
-- ... outros índices não utilizados
```

### Fase 2: Otimização de Queries React Query

**2.1 Converter fetches manuais para `useQuery`**

Arquivos a modificar:
- `src/pages/TradeFinanceiro.tsx`
- `src/pages/TradeCampaigns.tsx`
- `src/pages/TradeVerbasSemestrais.tsx`
- `src/components/tarefas/TaskDashboard.tsx`
- `src/pages/TradeAprovacoes.tsx`

Padrão a implementar:

```typescript
// ANTES (ineficiente)
useEffect(() => {
  fetchData();
}, []);

const fetchData = async () => {
  const [budgetsRes, accountsRes] = await Promise.all([...]);
  setBudgets(budgetsRes.data);
};

// DEPOIS (otimizado)
const { data: budgets, isLoading } = useQuery({
  queryKey: ['trade-budgets'],
  queryFn: async () => {
    const { data } = await supabase.from('trade_budgets').select('*');
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

**2.2 Remover invalidação agressiva em `ContasAReceber.tsx`**

Substituir invalidação em massa por refresh seletivo:

```typescript
// ANTES
useEffect(() => {
  keysToInvalidate.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
}, []);

// DEPOIS - Apenas refetch se dados estão stale
useEffect(() => {
  // Não invalidar automaticamente - confiar no staleTime
  // Adicionar botão de "Atualizar" manual se necessário
}, []);
```

**2.3 Aumentar cache no DREAnalitico**

```typescript
// ANTES
{ staleTime: 0, gcTime: 0 }

// DEPOIS
{ staleTime: 2 * 60 * 1000, gcTime: 5 * 60 * 1000 }
```

### Fase 3: Otimização do App.tsx

**3.1 Aumentar tempos de cache global**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 min (era 2 min)
      gcTime: 10 * 60 * 1000,   // 10 min (era 5 min)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Fase 4: Criar RPCs Agregadas para Dashboard

**4.1 RPC para KPIs do Módulo Financeiro**

Criar função no banco que retorna KPIs pré-calculados:

```sql
CREATE OR REPLACE FUNCTION get_financial_kpis(
  p_empresa_ids INT[] DEFAULT NULL,
  p_ano INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_a_pagar', SUM(CASE WHEN status != 'pago' THEN valor_aberto ELSE 0 END),
    'total_a_receber', (SELECT SUM(valor_aberto) FROM contas_receber WHERE status != 'recebido'),
    'vencidos_pagar', SUM(CASE WHEN status != 'pago' AND data_vencimento < CURRENT_DATE THEN valor_aberto ELSE 0 END),
    'vencidos_receber', (SELECT SUM(valor_aberto) FROM contas_receber WHERE status != 'recebido' AND data_vencimento < CURRENT_DATE)
  )
  FROM contas_pagar
  WHERE (p_empresa_ids IS NULL OR empresa_id = ANY(p_empresa_ids))
    AND EXTRACT(YEAR FROM data_vencimento) = p_ano;
$$ LANGUAGE sql STABLE;
```

**4.2 RPC para Dashboard do Trade**

```sql
CREATE OR REPLACE FUNCTION get_trade_dashboard_summary()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_budgets', (SELECT COUNT(*) FROM trade_budgets WHERE status = 'active'),
    'total_campaigns', (SELECT COUNT(*) FROM trade_campaigns WHERE status = 'active'),
    'pending_approvals', (SELECT COUNT(*) FROM trade_financial_entries WHERE status = 'pending'),
    'total_invested', (SELECT COALESCE(SUM(amount), 0) FROM trade_financial_entries WHERE status = 'approved')
  );
$$ LANGUAGE sql STABLE;
```

### Fase 5: Implementar Virtual Scrolling para Tabelas Grandes

Para tabelas com muitos registros (Contas a Pagar/Receber), implementar virtualização:

```typescript
// Usar react-virtual ou similar
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: totalItems,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48, // altura da linha
  overscan: 5,
});
```

---

## Cronograma de Implementação

| Fase | Ação | Impacto | Complexidade |
|------|------|---------|--------------|
| 1.1 | Limpar audit_logs | **Alto** | Média |
| 1.2 | Limpar sync_control | **Alto** | Baixa |
| 2.1 | Converter fetches manuais | **Médio** | Baixa |
| 2.2 | Remover invalidação agressiva | **Médio** | Baixa |
| 2.3 | Aumentar cache DRE | **Médio** | Baixa |
| 3.1 | Ajustar cache global | **Baixo** | Baixa |
| 4.1-4.2 | Criar RPCs agregadas | **Alto** | Média |
| 5 | Virtual scrolling | **Médio** | Alta |

---

## Resultados Esperados

- **Redução de 90%** no tempo de carregamento inicial (após limpeza audit_logs)
- **Redução de 70%** em requisições de rede (após cache otimizado)
- **Melhoria de 50%** na navegação entre páginas (após conversão para useQuery)
- **Economia de ~7 GB** de armazenamento no banco

---

## Arquivos a Modificar

### Banco de Dados (Migrations)
- Nova migration para limpeza de audit_logs
- Nova migration para limpeza de sync_control
- Nova migration para criar RPCs agregadas

### Frontend
- `src/App.tsx` - Aumentar tempos de cache
- `src/pages/TradeFinanceiro.tsx` - Converter para useQuery
- `src/pages/TradeCampaigns.tsx` - Converter para useQuery
- `src/pages/TradeVerbasSemestrais.tsx` - Converter para useQuery
- `src/pages/TradeAprovacoes.tsx` - Converter para useQuery
- `src/pages/ContasAReceber.tsx` - Remover invalidação agressiva
- `src/pages/DREAnalitico.tsx` - Aumentar staleTime
- `src/components/tarefas/TaskDashboard.tsx` - Converter para useQuery
