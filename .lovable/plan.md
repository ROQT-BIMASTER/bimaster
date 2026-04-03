
# Pipeline de Integração Direta com SQL Server — Status

## ✅ Fase 1 — Conectividade (Completa)
- Edge Function `erp-sync-engine` conectando via `npm:tedious`
- Secrets configurados: `ERP_SQL_HOST`, `ERP_SQL_PORT`, `ERP_SQL_USER`, `ERP_SQL_PASSWORD`, `ERP_SQL_DATABASE`

## ✅ Fase 2 — Pipeline de Sync (Completa)

### Tabelas SQL Server Descobertas

| View SQL Server | Destino Supabase | Tipo | Status |
|---|---|---|---|
| `ConsultaPowerBIReceber` | `contas_receber` | VIEW | ✅ 13.400+ registros sincronizados |
| `ConsultaPowerBIPagar` | `contas_pagar` | VIEW | ✅ Rota pronta |
| `ConsultaPowerBI` | Vendas/Pedidos (dados de venda por produto) | VIEW | 🔍 Não usado ainda |

### Rotas Disponíveis

| Rota | Descrição |
|---|---|
| `POST /test-connection` | Testa conexão SQL Server |
| `POST /list-tables` | Lista tabelas/views disponíveis |
| `POST /preview-table` | Preview de 10 rows (body: `{ table }`) |
| `POST /sync-contas-receber` | Sync paginado CR (500 rows/página) |
| `POST /sync-contas-pagar` | Sync paginado CP (500 rows/página) |
| `POST /sync-all` | Sync de todas as entidades |
| `POST /status` | Status da conexão e última sync |

### Arquitetura

```text
SQL Server (rubysp.ddns.net:1010)
  └─ ConsultaPowerBIReceber ──► erp-sync-engine (paginado 500/page)
  └─ ConsultaPowerBIPagar   ──► erp-sync-engine (paginado 500/page)
                                    └─ ROW_NUMBER() + dedup
                                    └─ Upsert batches 100 → Supabase
                                    └─ sync_control logging
```

## 🔲 Fase 3 — Pendente

1. **pg_cron**: Agendar `/sync-all` a cada 40 minutos
2. **Desativar N8N**: Remover webhooks gradualmente
3. **ConsultaPowerBI**: Avaliar se precisa sync (dados de vendas por produto)
