# Memory: features/fabrica-price-limits-per-table
Updated: 2026-01-28

## Table-Specific Price Limits System

Price limits (preco_maximo/preco_minimo) are now stored **per table** in `fabrica_limites_preco_tabela` instead of globally in `fabrica_produtos`.

### Key Changes:
1. **New Table**: `fabrica_limites_preco_tabela` stores limits specific to each price table
   - Unique constraint on (tabela_id, produto_id)
   - Limits set for E-commerce table won't affect other tables

2. **Migration**: Existing global limits were migrated to E-commerce table only (código 05)
   - Global limits in `fabrica_produtos.preco_maximo/preco_minimo` were cleared
   - These columns remain for backward compatibility but are no longer primary source

3. **Code Updates**:
   - `pricing-calculator.ts`: `buscarLimitesProduto()` now accepts optional `tabelaId` parameter
   - `calcularPrecosProdutos()` first checks table-specific limits, then falls back to global
   - `GerenciarLimitesPrecoDialog.tsx`: Now loads/saves limits from `fabrica_limites_preco_tabela`

### Usage:
- When setting price limits, select the target table first
- Limits set for "Tabela E-commerce" only apply when generating prices for that table
- Other tables (Fábrica, Mude, Clear, etc.) remain unaffected unless their own limits are set
