
# Corrigir Excesso de Títulos Vencidos e Sync Incremental — Contas a Receber

## Problemas Identificados

### 1. deriveStatus() no erp-sync-engine usa UTC (BUG PRINCIPAL)

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts` (linha 93-102)

```javascript
function deriveStatus(valorAberto, valorPago, dataVencimento) {
  // ...
  const hoje = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
  //                      ^^^^^^ UTC! Entre 21h-00h BRT = dia seguinte
}
```

O Edge Function roda em UTC. Entre 21h e meia-noite (horário de Brasília), o `new Date().toISOString()` retorna o dia seguinte. Resultado: títulos que vencem "hoje" no Brasil são marcados como `vencido` ao serem inseridos/atualizados.

Embora o trigger `calcular_status_conta_receber` (já corrigido na última migração para usar `America/Sao_Paulo`) sobrescreva esse status, a **lógica do deriveStatus no Edge Function é a fonte do campo `status` no JSON do upsert**, e o trigger só roda AFTER o INSERT/UPDATE — mas como o trigger é BEFORE, ele corrige. **Contudo**, o status derivado influencia logs e pode causar confusão na depuração.

### 2. Sync Incremental só captura títulos COM pagamento (BUG CRÍTICO)

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts` (linhas 692-701)

```javascript
whereClause = `[Data Pgto] IS NOT NULL AND [Data Pgto] >= '${sqlDate}' AND [Data Pgto] <= GETDATE()`;
```

O filtro incremental busca APENAS registros onde `[Data Pgto] IS NOT NULL`. Isso significa que:
- **Títulos que vencem e ficam em aberto** (sem pagamento) **nunca são re-sincronizados** após a sync full noturna
- O `valor_aberto` pode estar desatualizado por até 24h
- Títulos que tiveram seu valor parcialmente pago no ERP entre syncs NÃO são capturados se a baixa parcial não populou `[Data Pgto]`

### 3. fetchStats no useContasReceberSync usa UTC

**Arquivo**: `src/hooks/useContasReceberSync.ts` (linha 82)

```javascript
const today = new Date().toISOString().split('T')[0]; // UTC!
```

A tela de sincronização compara `data_vencimento` com `today` em UTC, podendo mostrar 1 dia a mais de vencidos entre 21h-00h BRT.

### 4. Trigger corrigido mas status no ERP pode estar stale

O trigger `calcular_status_conta_receber` já usa `America/Sao_Paulo` (migração anterior), mas ele só roda quando há INSERT/UPDATE. Se o título não é re-sincronizado (problema 2), o status fica congelado no valor da última sync.

---

## Correções Propostas

### Migração SQL

1. **Nenhuma alteração no trigger** — já está correto com timezone Brasil
2. **Recalcular status de todos os títulos pendentes/vencidos** com `valor_aberto > 0` para garantir que o status reflita a data de hoje no fuso correto (forçar re-trigger)

### Edge Function: erp-sync-engine

1. **Corrigir `deriveStatus()`** para usar fuso horário do Brasil:
```javascript
function deriveStatus(valorAberto, valorPago, dataVencimento) {
  if (valorAberto === 0 && valorPago > 0) return "recebido";
  if (valorPago > 0 && valorAberto > 0) return "parcial";
  if (valorAberto > 0 && dataVencimento) {
    const venc = new Date(dataVencimento + 'T00:00:00');
    // Usar timezone Brasil
    const brNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hoje = new Date(brNow.getFullYear(), brNow.getMonth(), brNow.getDate());
    if (venc < hoje) return "vencido";
  }
  return "pendente";
}
```

2. **Expandir sync incremental** para capturar TAMBÉM títulos sem pagamento que foram alterados recentemente no ERP. Novo filtro:
```sql
-- Captura pagamentos recentes E títulos modificados recentemente
([Data Pgto] IS NOT NULL AND [Data Pgto] >= '{lastSync}' AND [Data Pgto] <= GETDATE())
OR ([Vencimento] >= DATEADD(DAY, -7, GETDATE()) AND [Vencimento] <= DATEADD(DAY, 7, GETDATE()) AND [Valor em Aberto] > 0)
```

Isso garante que títulos vencendo nos próximos 7 dias e nos últimos 7 dias com saldo aberto sejam sempre re-sincronizados, capturando mudanças de status mesmo sem pagamento.

3. **Aumentar maxPages de 2 para 5** na sync incremental para acomodar o volume extra da janela de vencimento.

### Frontend: useContasReceberSync

Corrigir `fetchStats()` para usar timezone Brasil (consistente com `getToday()` de `dateUtils.ts`):
```javascript
// Usar getToday() que já resolve timezone Brasil
import { getToday, getDateKey } from '@/utils/dateUtils';
const today = getDateKey(getToday());
```

---

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | deriveStatus com TZ Brasil + sync incremental expandido |
| `src/hooks/useContasReceberSync.ts` | fetchStats com getToday() |
| 1 migração SQL | Recalcular status existentes |

## Impacto

- Elimina falsos vencidos causados por UTC entre 21h-00h BRT
- Títulos vencendo/vencidos são re-sincronizados a cada sync incremental (não só os pagos)
- Consistência total entre ERP, banco e frontend no fuso horário do Brasil
