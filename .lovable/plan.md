

# Segregação Configurável de Fornecedores por Módulo

## Contexto

Atualmente existem duas tabelas independentes:
- **`fornecedores`** — usada por Contas a Pagar, Trade, Departamentos, Eventos
- **`fabrica_fornecedores`** — usada por Fábrica (matérias-primas, recebimentos, NF-e)

A migração anterior copiou dados de `fabrica_fornecedores` para `fornecedores`, mas as FKs de fábrica ainda apontam para `fabrica_fornecedores`. O pedido é **manter as duas tabelas separadas** (empresas distintas do grupo) e tornar isso configurável.

## Arquitetura Proposta

```text
┌──────────────────────────────┐
│   fornecedor_modulos (nova)  │
│   modulo | tabela_ref        │
│   ─────────────────────────  │
│   contas_pagar → fornecedores│
│   fabrica → fabrica_fornec.  │
│   trade → fornecedores       │
│   eventos → fornecedores     │
└──────────────────────────────┘
```

Na prática, a segregação será implementada da seguinte forma:

### 1. Reverter referências de fábrica para `fabrica_fornecedores`

Os componentes de fábrica que foram migrados para `fornecedores` precisam voltar a usar `fabrica_fornecedores`:

| Componente | Ação |
|-----------|------|
| `NovaMateriaPrimaDialog.tsx` | Já usa `fabrica_fornecedores` — manter |
| `FichaCustoEditor.tsx` | Já usa `fabrica_fornecedores` — manter |
| `FabricaRecebimentos.tsx` | Já usa `fabrica_fornecedores` — manter |
| `process-nfe-xml/index.ts` | Já usa `fabrica_fornecedores` — manter |
| `useSupplierPaymentExceptions.ts` | Usa `fabrica_fornecedores` via FK — manter |

Esses já estão corretos. Nenhuma mudança necessária nos módulos de fábrica.

### 2. Garantir que AP/Trade/Eventos usem apenas `fornecedores`

Já foi feito na implementação anterior. Os seguintes componentes já apontam para `fornecedores`:
- `FinancialSubmissionForm.tsx`
- `FornecedorCombobox.tsx`
- `FornecedorQuickAdd.tsx`
- `FornecedorPaymentInfo.tsx`
- `SupplierDetailsCard.tsx`
- `Fornecedores.tsx` (página)
- `erp-fornecedores-query` (edge function)

### 3. Criar FornecedorQuickAdd específico para Fábrica

O `FornecedorQuickAdd.tsx` atual insere em `fornecedores`. O módulo Fábrica precisa de um equivalente que insira em `fabrica_fornecedores`.

**Novo arquivo**: `src/components/fabrica/FabricaFornecedorQuickAdd.tsx`
- Mesma UI do `FornecedorQuickAdd`
- Insere/atualiza em `fabrica_fornecedores`
- Usado por `NovaMateriaPrimaDialog` e formulários de recebimento

### 4. Página de Fornecedores da Fábrica

Criar uma página dedicada para gerenciar fornecedores de fábrica:

**Novo arquivo**: `src/pages/FabricaFornecedores.tsx`
- Rota: `/dashboard/fabrica/fornecedores`
- CRUD em `fabrica_fornecedores`
- Mesma estrutura da página `Fornecedores.tsx` (busca, tabela, painel de detalhes)
- Integração com `CnpjSearchButton` (consulta Receita)
- Filtros por status (ativo/inativo)

### 5. Adicionar rota e navegação

- Registrar rota `/dashboard/fabrica/fornecedores` no router
- Adicionar link no hub da Fábrica (`FabricaModule`)
- `screenCode`: `fabrica_fornecedores`

### 6. Configuração de segregação (tabela de controle)

**Migração SQL** — criar tabela `fornecedor_modulo_config`:

```sql
CREATE TABLE public.fornecedor_modulo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL UNIQUE,  -- 'fabrica', 'contas_pagar', 'trade', 'eventos'
  tabela_fornecedores text NOT NULL DEFAULT 'fornecedores',
  compartilhado boolean DEFAULT false,
  descricao text,
  created_at timestamptz DEFAULT now()
);

-- Dados iniciais
INSERT INTO fornecedor_modulo_config (modulo, tabela_fornecedores, compartilhado, descricao) VALUES
  ('fabrica', 'fabrica_fornecedores', false, 'Fornecedores da Fábrica (empresa separada)'),
  ('contas_pagar', 'fornecedores', true, 'Fornecedores de Contas a Pagar'),
  ('trade', 'fornecedores', true, 'Fornecedores de Trade Marketing'),
  ('eventos', 'fornecedores', true, 'Fornecedores de Eventos');
```

Essa tabela é consultável pela UI de configurações para permitir que o admin altere a segregação no futuro (ex: unificar tudo, ou separar trade).

### 7. Indicadores visuais na UI

Na página `/fornecedores` (AP), adicionar banner informativo:
> "Fornecedores do módulo Financeiro/Comercial. Para fornecedores da Fábrica, acesse o módulo Fábrica."

Na página `/fabrica/fornecedores`, banner equivalente:
> "Fornecedores exclusivos da Fábrica. Para fornecedores financeiros, acesse Cadastros > Fornecedores."

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar `fornecedor_modulo_config` com dados iniciais |
| `src/pages/FabricaFornecedores.tsx` | **Criar** — CRUD de `fabrica_fornecedores` com CNPJ |
| `src/components/fabrica/FabricaFornecedorQuickAdd.tsx` | **Criar** — Quick Add para `fabrica_fornecedores` |
| `src/pages/Fornecedores.tsx` | Adicionar banner de segregação |
| Router (App.tsx ou routes) | Adicionar rota `/dashboard/fabrica/fornecedores` |
| `FabricaModule` (hub) | Adicionar card de navegação para fornecedores |

## Benefícios

- Fábrica e AP operam com cadastros independentes sem conflito
- Consulta CNPJ disponível em ambas as páginas
- Configuração de segregação registrada em banco para futura flexibilização
- Zero impacto em FKs existentes (tudo continua apontando para suas tabelas originais)
- Operação atual não é interrompida

