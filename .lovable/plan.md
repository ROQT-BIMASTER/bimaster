

# Revisão Portal de Integração v1.9.0 — Correções Rápidas

## Escopo (sem APIs de estoque/vendas/cobrança)

Apenas correções de completude na documentação e tester existentes.

### 1. ApiTester — Presets e Body Templates faltantes

**Arquivo: `src/components/erp/ApiTester.tsx`**

- Adicionar preset `POST /contas-receber-api/desconciliar`
- Adicionar 4 body templates:
  - `/contas-receber-api/cancelar-recebimento` → `{ "codigo_baixa": 0 }`
  - `/contas-receber-api/conciliar` → `{ "codigo_baixa": 0 }`
  - `/contas-receber-api/desconciliar` → `{ "codigo_baixa": 0 }`
  - `/contas-receber-api/cancelar` → `{ "chave_lancamento": 0 }`

### 2. ApiDocumentation — Filtros CR `/listar`

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

Expandir params do endpoint CR `/listar` com 9 filtros faltantes:
`filtrar_conta_corrente`, `filtrar_cliente`, `filtrar_por_projeto`, `filtrar_por_vendedor`, `filtrar_por_cpf_cnpj`, `apenas_importado_api`, `ordenar_por`, `ordem_descrescente`, `filtrar_por_data_de/ate`

### 3. ApiDocumentation — Erros específicos

Adicionar 3 grupos de erros:
- Boletos `/gerar`
- Contas Correntes `/incluir`
- Lançamentos CC `/incluir`

### 4. Changelog v1.9.0

Entrada no changelog registrando as correções.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiTester.tsx` | 1 preset + 4 body templates |
| `src/components/erp/ApiDocumentation.tsx` | Filtros CR, erros, changelog |

