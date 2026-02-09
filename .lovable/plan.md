

## Melhorar a Visualizacao da Ficha de Custos

### Problemas identificados

1. **Tabela de insumos muito apertada** - 10 colunas comprimidas numa tabela horizontal, com inputs e selects minusculos
2. **Campos de configuracao com bug** - M.O. NF e M.O. Serviço ainda usam `type="number"`, causando o mesmo erro ao digitar "0.85"
3. **Layout geral denso** - muita informacao compactada sem respiro visual

### Solucao proposta

**Arquivo**: `src/components/fabrica/FichaCustoProdutoEditor.tsx`

#### 1. Corrigir inputs de configuracao
- Trocar `type="number"` por `type="text"` + `inputMode="decimal"` nos campos M.O. NF, M.O. Servico e Markup, aplicando a mesma validacao regex ja usada nos insumos
- Garantir que valores "0" sejam preservados

#### 2. Redesenhar a tabela de insumos como cards
Substituir a tabela horizontal por um layout de **cards empilhados** (um card por insumo), onde cada card mostra:

```text
+--------------------------------------------------+
| [Grip] CODIGO - Nome do Insumo           [Lixo]  |
| Tipo: [Select]    Fornecedor: [Input]             |
|                                                   |
|  NF: [____]   Servico: [____]   Condicao: [____]  |
|  NF Ref: [____________]                           |
+--------------------------------------------------+
```

- Campos de custo lado a lado em grid de 3 colunas (ou 4 com NF Ref)
- Inputs maiores e mais legíveis
- Cada card com borda sutil e padding adequado
- Codigo + nome no cabecalho do card
- Botao de remover no canto superior direito

#### 3. Melhorar espacamento geral
- Aumentar padding interno dos cards de configuracao
- Separar visualmente as secoes com mais respiro

### Escopo tecnico
- Alteracao apenas em `FichaCustoProdutoEditor.tsx`
- Sem mudancas de logica, banco de dados ou hooks
- Mesmos dados e callbacks, apenas reorganizacao visual

