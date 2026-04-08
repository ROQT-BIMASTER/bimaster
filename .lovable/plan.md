

# Correções na Tela de Insumos Vinculados

## Problemas Identificados

1. **Dados incompletos nos insumos vinculados** — As tabelas de insumos do produto vinculado estão com colunas faltando:
   - `InsumosOrigemPanel` (tela do editor): falta **Fornecedor** e **NF Ref.**
   - `FichaAnalisePanel` (tela de revisão): falta **Tipo** e **Total**

2. **Ordenação por fornecedor** — Atualmente os insumos são ordenados por `ordem` (campo do banco). O usuário quer agrupamento/ordenação sequencial por fornecedor.

## Mudanças

### 1. `src/components/fabrica/InsumosOrigemPanel.tsx`

- Adicionar colunas **Fornecedor** e **NF Ref.** na tabela de insumos
- Incluir `nf_referencia` na query do Supabase (adicionar ao select)
- Ordenar insumos por `fornecedor` (alfabético) em vez de `ordem`
- Colunas finais: Código | Insumo | Tipo | Fornecedor | NF Ref. | NF | Serviço | Condição | Total

### 2. `src/components/fabrica/FichaAnalisePanel.tsx` (seção Produtos Vinculados)

- Adicionar colunas **Tipo** e **Total** na tabela expandível dos vinculados
- Ordenar `vincInsumos` por `fornecedor` antes de renderizar
- Colunas finais: Código | Insumo | Tipo | Fornecedor | NF Ref. | NF | Serviço | Condição | Total

### 3. Ordenação global por fornecedor

- Em ambos os componentes, ordenar os insumos alfabeticamente por `fornecedor` (agrupando insumos do mesmo fornecedor em sequência)
- Insumos sem fornecedor ficam no final

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/fabrica/InsumosOrigemPanel.tsx` | Adicionar colunas Fornecedor + NF Ref., ordenar por fornecedor |
| `src/components/fabrica/FichaAnalisePanel.tsx` | Adicionar colunas Tipo + Total nos vinculados, ordenar por fornecedor |

