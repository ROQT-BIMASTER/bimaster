

# Fase 2 — Pipeline Completo de Sync Direto com ERP

## Tabelas SQL Server Confirmadas (do screenshot)

| View SQL Server | Destino Supabase | Status |
|---|---|---|
| `ConsultaPowerBIReceber` | `contas_receber` | ✅ Já testado na Fase 1 |
| `ConsultaPowerBIPagar` | `contas_pagar` | 🆕 Novo |
| `ConsultaPowerBI` | Possivelmente vendas/geral | 🔍 Investigar |

Nota: Vendedores não aparece como view separada — pode estar em `ConsultaPowerBI` ou em outra tabela. Vamos adicionar uma rota de descoberta para listar todas as tabelas.

## Implementação

### 1. Adicionar rota `/list-tables` (descoberta temporária)

Query `INFORMATION_SCHEMA.TABLES` para listar todas as views/tabelas com "PowerBI", "Vend", "Pagar", "Receber" no nome. Isso confirma se vendedores está em alguma view específica.

### 2. Adicionar rota `/sync-contas-receber`

Replica a lógica de `n8n-contas-receber`:
- Query paginada: `SELECT * FROM ConsultaPowerBIReceber` (com filtro `WHERE` por data se fornecido)
- Transforma usando `transformErpData()` (formato antigo com campos em português: `Valor em Aberto`, `ID Empresa`, etc.)
- Upsert em batches de 100 na tabela `contas_receber` (conflict on `erp_id`)
- Registra em `sync_control` e `sync_logs`

### 3. Adicionar rota `/sync-contas-pagar`

- Query: `SELECT * FROM ConsultaPowerBIPagar`
- Transformação similar, mapeando campos do SQL Server para `contas_pagar`
- Upsert com conflict on chave única

### 4. Adicionar rota `/sync-all`

Executa as 3 syncs em sequência, retornando resultado consolidado.

### 5. Adicionar rota `/status` (já existe parcial)

Expandir para mostrar última sync de cada entidade.

## Arquivos Alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Expandir com rotas list-tables, sync-contas-receber, sync-contas-pagar, sync-all |

## Estratégia de Execução

1. Primeiro deploy com `/list-tables` para confirmar estrutura das views
2. Chamar `/list-tables` via curl para ver todas as tabelas disponíveis
3. Com base nos resultados, implementar os mapeamentos corretos para cada sync
4. Testar cada sync individualmente antes de ativar `/sync-all`

## Próximo Passo (após pipeline pronto)

- Criar job `pg_cron` para chamar `/sync-all` a cada 40 minutos
- Desativar webhooks N8N gradualmente

