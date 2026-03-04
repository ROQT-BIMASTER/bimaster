

## Plano: Separar tabela de lançamentos em Clientes e Fornecedores com visão consolidada

### O que muda

A tabela única de lançamentos será substituída por um componente com **3 abas (Tabs)**:

1. **Consolidada** -- todos os lançamentos juntos (comportamento atual), com uma coluna extra indicando a origem (Cliente/Fornecedor)
2. **Clientes** -- apenas lançamentos de campanhas (`source === 'campaign'`), com coluna "Cliente"
3. **Fornecedores** -- apenas lançamentos financeiros diretos (`source === 'financial_entry'`), com coluna "Fornecedor" (usando `supplier_name`)

### Implementação

**Arquivo: `src/components/trade/dashboard/TradeLancamentosTable.tsx`**

- Envolver a tabela existente com `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`
- Criar 3 tabs: "Consolidada", "Clientes", "Fornecedores"
- Filtrar `lancamentos` conforme a aba ativa:
  - Consolidada: todos, adiciona coluna "Tipo" com badge Cliente/Fornecedor
  - Clientes: `source === 'campaign'`, coluna "Cliente"
  - Fornecedores: `source === 'financial_entry'`, coluna "Fornecedor" mostrando `supplier_name`
- Cada aba mantém os filtros de busca/status e o totalizador de rodapé independente
- O Dialog de detalhes continua funcionando igual

### Detalhes visuais
- Badge azul "Cliente" e badge laranja "Fornecedor" na aba consolidada
- Totais de rodapé calculados por aba filtrada
- Exportação Excel respeita a aba/filtro ativo

