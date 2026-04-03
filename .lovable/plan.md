

# Cadastrar Novo Plano de Contas (Planilha 2026)

## Resumo

A tabela `trade_chart_of_accounts` está vazia (0 contas). Vamos inserir todas as ~130 contas da planilha enviada, respeitando hierarquia, grupos, níveis e categorias DRE.

## Estrutura a Cadastrar

```text
1     RECEITA BRUTA (grupo)
├─ 1.1   Boletos - Banco
├─ 1.2   Depósitos em Conta
├─ 1.3   Cheque
└─ 1.4   Mercado Pago

2     CUSTOS VARIÁVEIS (grupo)
├─ 2.1   Fornecedores de Produtos (grupo)
│  ├─ 2.1.1  Compras Ruby Rose
│  ├─ 2.1.2  Devolução (Clientes)
│  └─ 2.1.3  Despesas Comerciais
├─ 2.2   Embalagens e Materiais
├─ 2.4   Fretes (grupo) → 5 sub-contas
├─ 2.5   Despesas Tributárias (grupo) → 6 sub-contas
├─ 2.6   Despesas Comerciais (grupo) → 2 sub-contas
└─ 2.7   Tarifas (grupo) → 1 sub-conta

3     DESPESAS FIXAS (grupo)
├─ 3.1   Desp. Administrativas → ~24 sub-contas + sub-níveis
├─ 3.2   Desp. com Pessoal → ~14 sub-contas + sub-níveis
├─ 3.3   Desp. Marketing → 13 sub-contas
├─ 3.4   Desp/Rec Financeiras → 2 sub-contas
└─ 3.5   Retirada dos Sócios → 1 sub-conta

4     CONTAS DE PATRIMÔNIO (grupo)
├─ 4.1   Rec/Desp Não Operacionais → 2 sub-contas
├─ 4.2   Atividades de Investimentos → 7 sub-contas
├─ 4.3   Atividades Financeiras → 9 sub-contas
└─ 4.4   Atividades com os Sócios → 2 sub-contas
```

## Detalhes Técnicos

### Inserção via SQL (ferramenta de inserção de dados)

- **Versão**: todas as contas com `versao = 'v2'`
- **Hierarquia**: `parent_account_id` vinculando filhos aos grupos pai
- **Níveis**: calculados pela profundidade do código (ex: `3.1.8.1` = nível 4)
- **Grupos**: contas que têm filhos marcadas com `is_group = true`, `permite_lancamento = false`
- **Contas analíticas**: `is_group = false`, `permite_lancamento = true`
- **Categoria DRE**:
  - Grupo 1.x → `receita_bruta`
  - Grupo 2.5.x → `deducoes`
  - Grupo 2.1/2.2/2.4/2.6/2.7 → `custo_vendas`
  - Grupo 3.x → `despesas_fixas`
  - Grupo 4.x → sem categoria DRE (patrimônio)
- **Account type**: `revenue` (1.x), `expense` (2.x, 3.x), `asset` (4.x)
- **Natureza**: `C` para receitas (1.x), `D` para despesas/custos (2.x, 3.x, 4.x)
- **Ordem**: sequencial para manter a ordem da planilha

### Inserção em etapas

1. Inserir grupos de nível 1 (1, 2, 3, 4)
2. Inserir grupos de nível 2 (1.1-1.4 como analíticas, 2.1, 2.4, 2.5, etc.)
3. Inserir contas de nível 3 (2.1.1, 3.1.1, etc.)
4. Inserir contas de nível 4 e 5 (3.1.1.1, 3.2.1.1.2, etc.)

Cada etapa precisa dos IDs gerados na anterior para definir `parent_account_id`.

| Ação | Detalhe |
|---|---|
| Inserção SQL (4 etapas) | ~130 contas na `trade_chart_of_accounts` com hierarquia completa |

