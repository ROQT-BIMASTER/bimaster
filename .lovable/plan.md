

## Plano: Conciliação Bancária Automática via Pluggy API

### Passo 1 — Secrets (Primeiro)

Antes de qualquer código, preciso solicitar as credenciais Pluggy de forma segura:
- `PLUGGY_CLIENT_ID`
- `PLUGGY_CLIENT_SECRET`

Vou usar a ferramenta de secrets seguras para você colar os valores sem exposição no chat.

### Passo 2 — Tabelas no Banco de Dados

**`bank_connections`** — Armazena as conexões Pluggy (item_id por conta bancária)
- `id`, `user_id`, `banco` (itau/bradesco), `pluggy_item_id`, `conta`, `agencia`, `status`, `last_sync`, `created_at`

**`conciliacoes_bancarias`** — Cada transação do extrato + status de match
- `id`, `bank_connection_id`, `data_transacao`, `valor`, `descricao`, `tipo` (debito/credito), `documento`, `conta_pagar_id` (FK nullable), `status_conciliacao` (conciliado/pendente/divergente/manual), `confianca` (alta/media/baixa), `created_at`

**`conciliacao_uploads`** — Histórico de sincronizações
- `id`, `bank_connection_id`, `total_transacoes`, `conciliados`, `pendentes`, `divergentes`, `duracao_ms`, `status`, `user_id`, `created_at`

RLS: autenticados com role admin ou financeiro via `has_role` ou departamento financeiro.

### Passo 3 — Edge Function `conciliacao-bancaria`

Ações:
- `connect` — Gera connect token Pluggy para o widget
- `sync-transactions` — Busca transações via Pluggy API e executa matching
- `match-manual` — Vincula manualmente uma transação a um `contas_pagar`
- `history` — Lista histórico de sincronizações

Matching automático em 3 níveis:
1. **Alta**: `numero_documento` + valor exato → auto-concilia e marca como Pago
2. **Média**: valor + data ±3 dias → status pendente
3. **Baixa**: fornecedor + valor ±5% → status pendente

### Passo 4 — UI

**Página `ConciliacaoBancaria.tsx`** em `/dashboard/financeiro/conciliacao-bancaria`:
- Botão "Conectar Banco" (widget Pluggy)
- Botão "Sincronizar Extrato"
- Dashboard: conciliados (verde), pendentes (amarelo), divergentes (vermelho)
- Tabela de pendentes com ação de vincular manualmente
- Histórico de syncs

**Card no Financeiro.tsx** — Adicionar na seção "Contas a Pagar e Receber"

**Rota no App.tsx** — Protegida por módulo financeiro

### Passo 5 — Integração

- Match alta confiança → `contas_pagar.status = 'Pago'`, `valor_pago`, `data_pagamento`
- Dispara `recalculate_contas_pagar_status`
- Invalida caches React Query (dashboard, DRE, fluxo de caixa)

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | 3 tabelas + RLS |
| `supabase/functions/conciliacao-bancaria/index.ts` | Edge function Pluggy + matching |
| `src/pages/financeiro/ConciliacaoBancaria.tsx` | Página principal |
| `src/components/conciliacao/DashboardConciliacao.tsx` | Dashboard de resultados |
| `src/components/conciliacao/TabelaPendentes.tsx` | Revisão manual |
| `src/hooks/useConciliacaoBancaria.ts` | Hook principal |
| `src/pages/Financeiro.tsx` | Adicionar card |
| `src/App.tsx` | Adicionar rota |

### Sequência de Execução

1. Solicitar secrets PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET
2. **Aguardar** o preenchimento antes de prosseguir
3. Criar tabelas e RLS
4. Implementar edge function + UI

