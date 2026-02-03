

# Plano: Limpeza em Lotes da Tabela audit_logs

## Problema Identificado

A tabela `audit_logs` possui **214 milhões de linhas** ocupando **61 GB**. As tentativas de DELETE em massa estão falhando por timeout devido ao volume de dados.

## Solução Proposta

Criar uma **função de limpeza em lotes** que deleta pequenas quantidades por vez (ex: 50.000 linhas por execução), evitando timeout e bloqueio do banco.

---

## Passos da Implementação

### 1. Criar Função de Limpeza em Lotes

Uma nova função PostgreSQL que:
- Deleta apenas 50.000 registros por execução
- Pode ser chamada repetidamente pelo cron
- Registra quantos registros foram deletados

### 2. Atualizar o Cron Job

Modificar o cron para:
- Executar a cada **10 minutos** ao invés de 1x por dia
- Usar a nova função de lotes
- Quando não houver mais registros antigos, simplesmente não faz nada

### 3. Limpeza Inicial Forçada

Criar uma função que pode ser executada manualmente para acelerar a limpeza inicial:
- Executa múltiplos lotes em sequência
- Com pausas entre lotes para não sobrecarregar

---

## Detalhes Técnicos

```text
+------------------------+     +------------------------+
| audit_logs             |     | Função batch_cleanup   |
| 214M linhas / 61 GB    | --> | DELETE LIMIT 50.000    |
+------------------------+     +------------------------+
                                        |
                                        v
                               +------------------------+
                               | Cron a cada 10 min     |
                               | ~7.200 lotes/dia       |
                               | = 360M deletes/dia     |
                               +------------------------+
```

**Tempo estimado para limpeza completa**: 
- Com 50K registros por lote, a cada 10 minutos = 144 execuções/dia
- 144 × 50.000 = 7.2 milhões de registros deletados por dia
- Para 200+ milhões de registros antigos ≈ **1 mês** para limpar tudo
- Podemos aumentar a frequência ou o tamanho do lote para acelerar

### Alternativa Mais Rápida
Se quiser acelerar, posso configurar:
- Lotes de 100.000 registros
- Execução a cada 5 minutos
- = ~28 milhões deletados por dia
- **1 semana** para limpar tudo

---

## Código SQL que Será Criado

```sql
-- Função de limpeza em lotes
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs_batch(
  batch_size INTEGER DEFAULT 50000,
  retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.audit_logs
    WHERE id IN (
      SELECT id FROM public.audit_logs
      WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
      LIMIT batch_size
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Atualizar cron para usar a nova função
SELECT cron.unschedule('cleanup-audit-logs-daily');

SELECT cron.schedule(
  'cleanup-audit-logs-batch',
  '*/10 * * * *', -- A cada 10 minutos
  $$SELECT public.cleanup_audit_logs_batch(50000, 30)$$
);
```

---

## Benefícios

- **Sem timeout**: lotes pequenos completam rapidamente
- **Sem bloqueio**: não trava outras operações do banco
- **Automático**: o cron cuida de tudo
- **Progressivo**: vai limpando aos poucos até regularizar
- **Sustentável**: após limpar, mantém a tabela sempre enxuta

