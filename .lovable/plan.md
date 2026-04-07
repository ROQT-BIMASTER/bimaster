

# Adicionar Vendedor e Supervisor na Tabela Principal de PDVs

## Objetivo

Exibir os nomes do vendedor e supervisor diretamente na tabela principal de Pontos de Venda, sem precisar abrir o detalhe de cada loja.

## Abordagem

A tabela `stores` já possui `vendedor_id` e `supervisor_id` (UUIDs). Basta fazer um JOIN com `profiles` na query de busca e adicionar duas colunas na tabela.

Para vendedores vinculados via `store_sellers` (múltiplos), exibir o nome do vendedor principal (`is_principal = true`), com indicação de quantos outros há.

## Implementação

### 1. `TradeStores.tsx` — Expandir interface Store e query

- Adicionar campos `vendedor_nome` e `supervisor_nome` à interface `Store`
- Após buscar as stores, fazer duas queries adicionais:
  - `profiles` para os `supervisor_id` distintos → montar mapa `id → nome`
  - `store_sellers` com JOIN em `profiles` para os store IDs → montar mapa `store_id → nome vendedor principal`
- Mesclar os nomes nos objetos de store antes de setar o estado

### 2. `TradeStores.tsx` — Adicionar colunas na definição `columns`

Adicionar após a coluna "Rede":
- **Vendedor**: exibe o nome do vendedor principal da `store_sellers`, ou fallback para `vendedor_id` da tabela stores. Se houver múltiplos, mostrar "+N"
- **Supervisor**: exibe o nome do supervisor via `supervisor_id`

Ambas com `hideOnMobile: true`.

### 3. Card mobile — Adicionar info de vendedor/supervisor

Exibir vendedor e supervisor como texto secundário no card mobile.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/TradeStores.tsx` | Expandir interface, query com nomes, 2 novas colunas + card mobile |

