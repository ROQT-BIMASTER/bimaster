

# Ativação do Sync Automático — Contas a Receber

## Situação Atual

- O motor `erp-sync-engine` está funcional e com lógica de status correta
- Os 351k registros estão no banco com status corretos
- **Porém não existe agendamento automático** — a sync só roda quando disparada manualmente
- Existe um cron antigo do N8N (`sync-contas-receber-6h`) que chama uma edge function diferente (`n8n-contas-receber`) e pode estar desatualizada

## Plano

### 1. Criar pg_cron para erp-sync-engine (a cada 40 min)

Inserir via SQL um job `pg_cron` que chama `POST /erp-sync-engine` com `path: "sync-contas-receber"` a cada 40 minutos. Isso garante que:
- Pagamentos novos do dia são refletidos em até 40 min
- Títulos vencidos são recalculados automaticamente (a `deriveStatus` compara com `now()`)
- Pagamentos atrasados realizados no ERP atualizam o status para "recebido" ou "parcial"

### 2. Desativar cron antigo do N8N

O job `sync-contas-receber-6h` (jobid 1) chama `n8n-contas-receber/sync-auto`, que é o fluxo legado. Com o `erp-sync-engine` ativo a cada 40 min, este job se torna redundante e pode causar conflitos de dados.

### 3. (Opcional futuro) Sync incremental

Hoje toda sync relê os 351k registros (~3 min). Uma melhoria futura seria adicionar uma rota `sync-contas-receber-incremental` que filtra a view SQL Server por `data_modificacao >= DATEADD(MINUTE, -45, GETDATE())`, processando apenas registros alterados (~500-2000 por ciclo).

## Resultado Esperado

- Sync automática a cada 40 min sem intervenção manual
- Pagamentos do dia refletidos em até 40 min
- Status "vencido" atualizado automaticamente para títulos que passam da data
- Cron legado desativado para evitar conflitos

## Alterações

| Item | Tipo |
|---|---|
| `pg_cron` job para `erp-sync-engine` | SQL INSERT (não migration) |
| Desativar job `sync-contas-receber-6h` | SQL `cron.unschedule` |

