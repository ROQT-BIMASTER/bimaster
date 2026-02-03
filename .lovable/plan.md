

# Plano: Remover Cron Duplicado e Prevenir Reincidência

## Problema Identificado

Existem **2 cron jobs idênticos** sincronizando contas a receber:

| Job ID | Nome | Schedule | Impacto |
|--------|------|----------|---------|
| 1 | sync-contas-receber-6h | A cada 6h | Gasto duplo |
| 2 | sync-contas-receber-auto | A cada 6h | Gasto duplo |

Isso causa **custos dobrados** em execução de edge functions e processamento.

---

## Ação Imediata

### 1. Remover o Cron Duplicado

Executar o seguinte SQL para remover o job duplicado (mantendo apenas o jobid 1):

```sql
SELECT cron.unschedule('sync-contas-receber-auto');
```

---

## Plano Preventivo (Boas Práticas)

### 2. Padrão de Nomenclatura

Adotar convenção para evitar duplicatas:
- Nome único e descritivo: `{modulo}-{acao}-{frequencia}`
- Exemplos: `trade-cleanup-10min`, `financeiro-sync-6h`

### 3. Checagem Antes de Criar Jobs

Sempre verificar jobs existentes antes de criar novos:

```sql
-- Verificar se já existe antes de criar
SELECT * FROM cron.job WHERE jobname LIKE '%contas-receber%';
```

### 4. Usar CREATE OR REPLACE

Ao criar funções auxiliares, usar `CREATE OR REPLACE` para evitar duplicação de funções no banco.

### 5. Documentação dos Cron Jobs Ativos

Após a limpeza, os jobs ativos serão:

| Job | Função | Frequência |
|-----|--------|------------|
| cleanup-audit-logs-batch | Limpar logs antigos | 10 min |
| cleanup-sync-control-daily | Limpar sync_control | Diário 03h |
| sync-contas-receber-6h | Sincronizar financeiro | 6h |

---

## Detalhes Técnicos

### Economia Esperada

- **Antes**: 8 execuções/dia (2 jobs × 4 vezes)
- **Depois**: 4 execuções/dia (1 job × 4 vezes)
- **Redução**: 50% nas chamadas de sincronização

### Verificação Pós-Implementação

Script para confirmar que não há mais duplicatas:

```sql
SELECT jobname, schedule, COUNT(*) 
FROM cron.job 
GROUP BY jobname, schedule 
HAVING COUNT(*) > 1;
```

Se retornar vazio, não há duplicatas.

