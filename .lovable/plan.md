

## Auditoria Completa: contas-receber-api

### Estado Atual — O que já está OK

| Item | Status | Detalhe |
|------|--------|---------|
| Secret `N8N_API_KEY` | ✅ Configurado | Existe nos secrets do projeto |
| Secret `POLLO_API_KEY` | ✅ Configurado | Existe nos secrets do projeto |
| UNIQUE constraint `erp_id` | ✅ Existe | `contas_receber_erp_id_key` |
| Colunas `contas_receber` | ✅ Completas | Todas as 30+ colunas necessárias existem |
| Colunas `sync_control` | ✅ Completas | `entidade`, `empresa_id`, `ultima_sync`, `total_registros`, `registros_inseridos`, `duracao_ms`, `status` — todas presentes |
| RLS + service_role | ✅ OK | service_role bypassa RLS automaticamente no Supabase |
| Lógica de UPSERT | ✅ OK | `onConflict: 'erp_id'`, `ignoreDuplicates: false` |
| Extração de dados | ✅ OK | Aceita arrays de 1 a N registros |

### Problema Real Encontrado — Trigger com search_path vazio

A função `trigger_atualizar_perfil_credito()` tem `SET search_path TO ''` (vazio), mas chama `atualizar_perfil_credito_cliente(NEW.cliente_codigo)` **sem prefixo `public.`**. Isso faz com que cada INSERT/UPDATE na tabela `contas_receber` **falhe** porque o PostgreSQL não consegue encontrar a função.

Mesma situação no `calcular_status_conta_receber()` — tem `search_path TO ''` mas não referencia funções externas, então funciona.

### Plano de Correção

#### 1. Migration: Corrigir trigger `trigger_atualizar_perfil_credito`

Recriar a função com `public.` nos nomes das funções chamadas:

```sql
CREATE OR REPLACE FUNCTION public.trigger_atualizar_perfil_credito()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  PERFORM public.atualizar_perfil_credito_cliente(NEW.cliente_codigo);
  RETURN NEW;
END;
$$;
```

#### 2. Melhorar logging na Edge Function

Adicionar logs de diagnóstico no handler POST /sync:
- Log das keys do body e tamanho do array `contas`
- Log do primeiro registro do batch em caso de erro no upsert

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| Migration SQL | Corrigir `trigger_atualizar_perfil_credito` com schema qualificado |
| `supabase/functions/contas-receber-api/index.ts` | Adicionar logging melhorado no POST /sync e no catch do upsert |

### Resultado Esperado

Com a correção do trigger, o fluxo n8n → Edge Function → upsert em `contas_receber` → trigger de perfil de crédito funcionará sem erros. Os dados serão inseridos corretamente.

