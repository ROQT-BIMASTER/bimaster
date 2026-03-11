

## Painel de Conciliação Multi-Filial com Saldos Bancários

### Problema Atual
A tabela `bank_connections` está vinculada apenas a `user_id`, sem relação com filiais (`empresas`). Não existe informação de saldo nas conexões bancárias. O painel atual é plano — não distingue contas por filial.

### Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────┐
│  PAINEL DE CONCILIAÇÃO BANCÁRIA                     │
├─────────────────────────────────────────────────────┤
│  [Filtro: Todas Filiais ▾]   [+ Conectar Banco]    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Saldo Total │ │ Entradas    │ │ Saídas      │   │
│  │ R$ 1,2M     │ │ R$ 340K     │ │ R$ 280K     │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
├─────────────────────────────────────────────────────┤
│  FILIAL SÃO PAULO                                   │
│  ┌──────────────────────────────────────────────┐   │
│  │ Itaú CC 12345   Saldo: R$ 450K   [Sync] ⟳  │   │
│  │ Bradesco CC 678 Saldo: R$ 120K   [Sync] ⟳  │   │
│  └──────────────────────────────────────────────┘   │
│  FILIAL RIO DE JANEIRO                              │
│  ┌──────────────────────────────────────────────┐   │
│  │ BB CC 91011     Saldo: R$ 630K   [Sync] ⟳  │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  [Dashboard] [Transações] [Histórico]               │
│  ... tabelas existentes filtradas por filial ...    │
└─────────────────────────────────────────────────────┘
```

### Mudanças

#### 1. Migração de banco de dados
- Adicionar `empresa_id INTEGER REFERENCES empresas(id)` na tabela `bank_connections`
- Adicionar `saldo_atual NUMERIC(15,2) DEFAULT 0` na tabela `bank_connections`
- Adicionar `saldo_atualizado_em TIMESTAMPTZ` na tabela `bank_connections`
- Criar índice em `bank_connections(empresa_id)`

#### 2. Edge function `conciliacao-bancaria`
- Na ação `save-connection`: aceitar `empresa_id` e salvar na conexão
- Na ação `sync-transactions`: após buscar contas da Pluggy, extrair o saldo (`account.balance`) e atualizar `saldo_atual` e `saldo_atualizado_em` na `bank_connections`
- Na ação `list-connections`: aceitar filtro opcional por `empresa_id`

#### 3. Novo componente `PainelSaldos.tsx`
- Cards agrupados por filial mostrando cada conta bancária com: banco, agência/conta, saldo atual, data da última atualização, botão de sync individual
- Card resumo no topo: saldo total consolidado, total entradas (últimos 30d), total saídas (últimos 30d)
- Filtro por filial usando `useUserEmpresas`

#### 4. Atualizar `ConciliacaoBancaria.tsx`
- Adicionar seletor de filial no topo (usando empresas do usuário)
- Ao conectar banco, pedir para selecionar a filial antes de abrir o Pluggy
- Inserir o `PainelSaldos` como primeira seção
- Filtrar conexões e conciliações pela filial selecionada

#### 5. Atualizar `useConciliacaoBancaria.ts`
- Aceitar `empresaId` como parâmetro
- Filtrar `list-connections` por empresa
- Filtrar `conciliacoes_bancarias` por conexões da empresa selecionada

### Detalhes técnicos

**Migração SQL:**
```sql
ALTER TABLE bank_connections 
  ADD COLUMN empresa_id INTEGER REFERENCES empresas(id),
  ADD COLUMN saldo_atual NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN saldo_atualizado_em TIMESTAMPTZ;

CREATE INDEX idx_bank_connections_empresa ON bank_connections(empresa_id);
```

**Extração de saldo na sync (edge function):**
```typescript
// Após buscar accounts da Pluggy
for (const account of accountsData.results) {
  // account.balance contém o saldo atual
}
const totalBalance = accountsData.results.reduce(
  (sum, acc) => sum + (acc.balance || 0), 0
);
await supabase.from("bank_connections").update({
  saldo_atual: totalBalance,
  saldo_atualizado_em: new Date().toISOString(),
}).eq("id", connectionId);
```

**Dialog de seleção de filial antes de conectar:**
```tsx
// Modal simples com Select de empresas
// Ao confirmar, abre o Pluggy e salva empresa_id junto com a conexão
```

