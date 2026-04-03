

# Pipeline de Integração Direta com SQL Server — Dados Confirmados

## Dados de Conexão Identificados (do screenshot)

| Parâmetro | Valor |
|---|---|
| Host | `rubysp.ddns.net` |
| Porta | `1010` |
| Database | `Ruby_sp` |
| Usuário | `leandrosp` |
| Senha | *(preciso que informe — estava cortada no screenshot)* |
| Autenticação | SQL Auth (usuário/senha) |

## Secrets a Configurar

Serão 5 secrets novos no backend (nenhum existe ainda):

| Secret | Valor |
|---|---|
| `ERP_SQL_HOST` | `rubysp.ddns.net` |
| `ERP_SQL_PORT` | `1010` |
| `ERP_SQL_USER` | `leandrosp` |
| `ERP_SQL_PASSWORD` | *(você informa)* |
| `ERP_SQL_DATABASE` | `Ruby_sp` |

## Arquitetura do Pipeline

```text
┌──────────────────────┐          ┌─────────────────────────┐
│  SQL Server ERP      │◄─ TDS ──│  Edge Function           │
│  rubysp.ddns.net:1010│          │  erp-sync-engine         │
│  DB: Ruby_sp         │          │  (npm:tedious)           │
└──────────────────────┘          └──────────┬──────────────┘
                                             │ upsert batches
                                   ┌─────────▼──────────────┐
                                   │  Supabase Tables       │
                                   │  contas_receber        │
                                   │  contas_pagar          │
                                   │  dimensao_vendedores   │
                                   └────────────────────────┘
```

## Fluxo Atual vs Proposta

```text
HOJE:   Edge Function → N8N webhook (huggs.app.n8n.cloud) → SQL Server → N8N transforma → devolve → upsert
DEPOIS: Edge Function → SQL Server direto (tedious) → transforma internamente → upsert
```

## Implementação em 2 Fases

### Fase 1 — Teste de Conectividade

Criar Edge Function `erp-sync-engine` mínima com rota `/test-connection`:
- Importa `npm:tedious`
- Conecta em `rubysp.ddns.net:1010` com SQL Auth
- Executa `SELECT TOP 5 * FROM ConsultaPowerBIReceber` (ou tabela que confirmar)
- Retorna resultado como JSON para validar driver + rede

| Arquivo | Ação |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Criar — função de teste |

### Fase 2 — Pipeline Completo (após teste OK)

Expandir para rotas de sync completas, replicando a lógica do N8N:

| Rota | Query SQL Server | Destino Supabase |
|---|---|---|
| `/sync-contas-receber` | `ConsultaPowerBIReceber` | `contas_receber` |
| `/sync-contas-pagar` | *(confirmar nome da tabela)* | `contas_pagar` |
| `/sync-vendedores` | *(confirmar nome da tabela)* | `dimensao_vendedores` |
| `/sync-all` | Todas em sequência | — |
| `/status` | Testa conexão + última sync | — |

Agendamento via `pg_cron` a cada 40 minutos (mesmo intervalo atual).

## Informações que Ainda Faltam

Antes de criar o pipeline, preciso confirmar:

1. **Senha do SQL Server** — cortada no screenshot
2. **Nomes exatos das tabelas/views** no SQL Server para cada entidade:
   - Contas a Receber → `ConsultaPowerBIReceber`? (aparece no código N8N)
   - Contas a Pagar → qual nome?
   - Vendedores → qual nome?
3. **TLS/Encrypt** — o SQL Server exige conexão criptografada? (geralmente `encrypt: false` para servidores on-premise com DDNS)

## Ordem de Execução

1. Você fornece a senha e confirma nomes das tabelas
2. Configuro os 5 secrets no backend
3. Crio a Fase 1 (teste de conectividade)
4. Testamos juntos
5. Se OK, implemento Fase 2 (pipeline completo + pg_cron)
6. Atualizo UI: "N8N" → "Sync Direto ERP"

