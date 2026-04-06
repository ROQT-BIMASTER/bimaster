

# Visão por Fornecedor + Campo "Substituído por" no Plano de Redução

## Objetivo

Adicionar um toggle entre a visão atual (agrupada por departamento) e uma nova visão agrupada por fornecedor. Adicionar também um campo `substituido_por` para registrar qual ferramenta interna substituirá cada fornecedor.

## Alterações

### 1. Migração SQL — novo campo `substituido_por`

```sql
ALTER TABLE contas_pagar_revisao ADD COLUMN substituido_por text;
```

Campo texto livre para indicar qual sistema/ferramenta vai substituir o fornecedor (ex: "BiMaster", "Sistema interno", etc.).

### 2. `src/components/financeiro/PlanoReducaoGastos.tsx`

- **Toggle de visão**: Adicionar um estado `viewMode` com duas opções (`'departamento'` | `'fornecedor'`) e um botão segmentado (ou tabs) no header da tabela para alternar.
- **Agrupamento por fornecedor**: Criar lógica `groupedByFornecedor` que agrupa `filteredRevisoes` por `fornecedor_nome`, com total por grupo — mesma estrutura visual do agrupamento por departamento.
- **Coluna "Substituído por"**: Adicionar coluna na tabela desktop mostrando o valor de `substituido_por`. No detalhe expandido, exibir campo editável (input inline) para preencher/alterar o valor.
- **Salvar "Substituído por"**: Função para fazer `UPDATE` no registro quando o usuário editar o campo inline.

### 3. Visão por Fornecedor — Layout

Na visão por fornecedor, cada grupo mostra:
- Nome do fornecedor como header do grupo (com badge de quantidade e total R$)
- Linhas individuais de cada registro daquele fornecedor
- Coluna extra "Substituído por" com o texto indicando a ferramenta substituta

## Arquivos

| Arquivo | Alteração |
|---|---|
| 1 migração SQL | `ADD COLUMN substituido_por text` |
| `src/components/financeiro/PlanoReducaoGastos.tsx` | Toggle departamento/fornecedor + coluna/campo "Substituído por" |

