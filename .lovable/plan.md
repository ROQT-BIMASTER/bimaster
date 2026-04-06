

# Corrigir Status Financeiro (Recebido/Pendente/Vencido) — Fuso Horário Brasil

## Problema Raiz

O trigger `calcular_status_conta_receber` no banco de dados usa `CURRENT_DATE` que opera em **UTC**. O servidor Supabase roda em UTC, mas o negócio opera no fuso horário do Brasil (UTC-3).

**Impacto concreto**: Entre 21h e meia-noite (horário de Brasília), o servidor já considera que é o dia seguinte. Resultado:
- Títulos que vencem **hoje** são marcados como `vencido` 3 horas antes do fim do dia no Brasil
- Status inconsistente entre o que o banco calcula e o que o usuário espera

### Dados confirmados no banco:
- **424.020** títulos `recebido`, **26.747** `pendente`, **8.276** `vencido`, **245** `parcial`
- O trigger `calcular_status_conta_receber` roda em EVERY INSERT/UPDATE e determina o status automaticamente
- `data_recebimento` é preenchido mesmo em títulos `pendente` (é previsão, não data efetiva)
- O campo `data_vencimento` é tipo `date` (sem horário)

### Segundo problema: Frontend
O hook `calculateFinancialStatus` não reconhece o status `recebido` (só reconhece `pago`). Quando o status do banco é `recebido`, cai no fallback e, se `data_recebimento` estiver preenchida, retorna `pago` incorretamente.

---

## Correções

### 1. Migração SQL — Trigger com fuso horário do Brasil

Reescrever `calcular_status_conta_receber` substituindo `CURRENT_DATE` por `(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`:

```sql
CREATE OR REPLACE FUNCTION calcular_status_conta_receber()
RETURNS TRIGGER AS $$
DECLARE
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  -- Dias de atraso baseado no fuso do Brasil
  IF NEW.data_vencimento IS NOT NULL THEN
    NEW.dias_atraso := GREATEST(0, v_hoje - NEW.data_vencimento);
  ELSE
    NEW.dias_atraso := 0;
  END IF;
  
  -- Status baseado em valores e datas
  IF COALESCE(NEW.valor_aberto, 0) <= 0 THEN
    NEW.status := 'recebido';
  ELSIF COALESCE(NEW.valor_recebido, 0) > 0 AND COALESCE(NEW.valor_aberto, 0) > 0 THEN
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento < v_hoje AND COALESCE(NEW.valor_aberto, 0) > 0 THEN
    NEW.status := 'vencido';
  ELSE
    NEW.status := 'pendente';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Migração SQL — Recalcular status existentes

Forçar recálculo dos títulos pendentes/vencidos que podem estar com status errado (os que vencem hoje no Brasil mas estavam como vencido por causa do UTC):

```sql
-- Touch dos registros para re-disparar o trigger com a lógica corrigida
UPDATE contas_receber 
SET updated_at = now() 
WHERE status IN ('pendente', 'vencido') 
  AND valor_aberto > 0;
```

### 3. Frontend — Hook `calculateFinancialStatus`

Adicionar reconhecimento do status `recebido` e usar timezone Brazil no cálculo local:

**Arquivo**: `src/hooks/useFinancialStatus.ts`
- Adicionar `if (statusLower === 'recebido') return 'pago';` na lista de status reconhecidos
- Isso garante que quando o banco retorna `recebido`, o frontend trata corretamente como pago

### 4. Frontend — `getToday()` com fuso Brasil

**Arquivo**: `src/utils/dateUtils.ts`
- Atualizar `getToday()` para usar `Intl.DateTimeFormat` com timezone `America/Sao_Paulo`, garantindo que mesmo usuários em outros fusos vejam a data correta do negócio

### 5. Corrigir RPCs de dashboard que usam CURRENT_DATE

Verificar e corrigir as RPCs `get_contas_receber_dashboard_kpis`, `get_contas_receber_status_dist`, `get_contas_receber_aging` para usar `(NOW() AT TIME ZONE 'America/Sao_Paulo')::date` em vez de `CURRENT_DATE`.

---

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| 1 migração SQL | Trigger corrigido + recálculo de status existentes |
| 1 migração SQL | RPCs corrigidas com timezone Brasil |
| `src/hooks/useFinancialStatus.ts` | Reconhecer status `recebido` |
| `src/utils/dateUtils.ts` | `getToday()` com timezone Brasil |

## Impacto

- Zero discrepância de status entre 21h-00h (horário de Brasília)
- Frontend e banco alinhados no mesmo fuso horário
- ~35.000 títulos pendentes/vencidos recalculados com a lógica correta

