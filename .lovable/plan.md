# Substituir N8N: Conexão Direta ao SQL Server via Edge Functions

## Arquitetura

Como o SQL Server está acessível pela internet, podemos conectar **diretamente** das Edge Functions usando `npm:tedious` (driver TDS puro em JavaScript, compatível com Deno).

```text
┌─────────────────┐                    ┌─────────────────────┐
│  SQL Server ERP │◄── TDS (1433) ────│  Edge Function      │
│  (IP público)   │                    │  erp-sync-engine    │
└─────────────────┘                    └─────────┬───────────┘
                                                 │ upsert
                                       ┌─────────▼───────────┐
                                       │  Supabase Tables    │
                                       │  (contas_receber,   │
                                       │   contas_pagar, etc)│
                                       └─────────────────────┘
                                                 ▲
                                       ┌─────────┴───────────┐
                                       │  pg_cron Schedule   │
                                       │  (a cada 40 min)    │
                                       └─────────────────────┘
```

**Zero dependência externa. Zero custo adicional.**

---

## Implementação

### 1. Secrets necessários

| Secret | Valor |
|---|---|
| `ERP_SQL_HOST` | IP ou hostname do SQL Server |
| `ERP_SQL_PORT` | Porta (default 1433) |
| `ERP_SQL_USER` | Usuário de leitura |
| `ERP_SQL_PASSWORD` | Senha |
| `ERP_SQL_DATABASE` | Nome do banco |

### 2. Edge Function: `erp-sync-engine/index.ts`

Uma única Edge Function com rotas internas para cada entidade:

| Rota | Função |
|---|---|
| `POST /sync-contas-receber` | Consulta SQL Server → upsert em `contas_receber` |
| `POST /sync-contas-pagar` | Consulta SQL Server → upsert em `contas_pagar` |
| `POST /sync-vendedores` | Consulta SQL Server → upsert em `dimensao_vendedores` |
| `POST /sync-estoque` | Consulta SQL Server → upsert em tabela estoque |
| `GET /status` | Status de conexão e última sync |
| `POST /sync-all` | Executa todas as syncs em sequência |

**Lógica interna:**
- Conecta ao SQL Server via `npm:tedious`
- Executa as mesmas queries SQL que o N8N usa hoje (extraídas dos docs)
- Transforma dados (mesma lógica do `transformErpData` existente)
- Upsert em batches de 1000 no Supabase
- Registra em `sync_logs` e `sync_control`

### 3. Agendamento via pg_cron

```sql
-- A cada 40 minutos, dispara sync de todas as entidades
SELECT cron.schedule('erp-sync-all', '*/40 * * * *', $$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY"}'::jsonb,
    body := '{"path":"sync-all"}'::jsonb
  );
$$);
```

### 4. Ajustes na UI

| Arquivo | Alteração |
|---|---|
| `src/components/financeiro/N8NTabContent.tsx` | Renomear para "Sync Direto ERP". Trocar trigger de N8N webhook para `erp-sync-engine/sync-all` |
| `src/components/financeiro/ContasPagarSyncPanel.tsx` | Atualizar labels e referências |

### 5. Manter compatibilidade

As Edge Functions existentes (`contas-receber-api/sync`, `contas-pagar-api/sync`) continuam funcionando para receber dados — caso queiram manter o N8N em paralelo durante a transição.

---

## Limitações e Mitigações

| Risco | Mitigação |
|---|---|
| Edge Function timeout (60s default) | Processar em páginas menores (500 registros). Para volumes muito grandes, usar múltiplas chamadas encadeadas via pg_cron |
| `tedious` no Deno | É puro JS, compatível. Testaremos na primeira iteração |
| SQL Server firewall | Usuário precisa liberar IP do Supabase (ou range de IPs da região) |

---

## Economia

| Item | N8N | Sync Direto |
|---|---|---|
| Custo mensal | Assinatura N8N | R$ 0 |
| Dependências | N8N Cloud + workflows | Nenhuma |
| Manutenção | N8N + código | Só código versionado |
| Limite execuções | Plano N8N | Ilimitado |

## Ordem de execução

1. Configurar secrets do SQL Server
2. Criar Edge Function `erp-sync-engine` com conexão tedious
3. Testar conectividade e queries
4. Configurar pg_cron
5. Atualizar UI (renomear N8N → Sync Direto)
6. Validar em produção com dados reais
