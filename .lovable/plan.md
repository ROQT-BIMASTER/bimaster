

# Controle de Acesso Granular: Por Linha e Por Produto

## Situacao Atual

Hoje o controle de acesso (`user_price_table_access`) permite restringir usuarios por **tabela de preco** inteira, com tres niveis de permissao: visualizar, editar e aprovar. Nao existe forma de restringir a visibilidade ou edicao a apenas uma linha de produto (ex: "Banana") ou a um produto individual dentro de uma tabela.

## O Que Sera Feito

Adicionar duas novas colunas opcionais na tabela `user_price_table_access` para permitir restricoes mais granulares:

- **linha** (text, nullable) -- restringe o acesso apenas aos produtos daquela linha
- **produto_id** (uuid, nullable) -- restringe o acesso a um produto individual

### Hierarquia de Acesso (mais especifico vence)

```text
1. Regra com produto_id definido (mais restritiva/especifica)
2. Regra com linha definida
3. Regra so com tabela_id (comportamento atual - acesso a tabela inteira)
```

Se um usuario tem apenas uma regra com `linha = "Banana"` para a tabela Distribuidor, ele so vera os produtos da linha Banana nessa tabela.

## Detalhes Tecnicos

### 1. Alteracao na tabela `user_price_table_access`

Adicionar duas colunas:
- `linha` (text, nullable) -- nome da linha de produto
- `produto_id` (uuid, nullable, FK para fabrica_produtos)

Atualizar a constraint unique de `(user_id, tabela_id)` para `(user_id, tabela_id, linha, produto_id)` para permitir multiplas regras por tabela.

### 2. Alteracao no Hook `useUserPriceTableAccess`

Extender o hook para expor funcoes adicionais:
- `canViewProduct(tabelaId, linha, produtoId)` -- verifica se o usuario pode ver um produto especifico
- `filterProductsByAccess(tabelaId, produtos)` -- filtra lista de produtos baseado nas restricoes
- Manter compatibilidade total: se nao ha restricoes de linha/produto, funciona como hoje

### 3. Alteracao na UI de Gerenciamento (`GerenciamentoAcessoPrecos.tsx`)

No dialog "Adicionar Acesso":
- Apos selecionar a tabela, exibir opcao de escopo: "Tabela Inteira", "Por Linha" ou "Por Produto"
- Se "Por Linha": dropdown com as linhas existentes (Banana, MELU, Pistache, etc.)
- Se "Por Produto": busca de produto com autocomplete
- Na listagem, exibir badges indicando o escopo da regra

### 4. Integracao nos componentes de precos

Nos locais onde produtos sao exibidos (GeradorPrecosDialog, Matriz Comparativa, Portal Cliente), aplicar a filtragem granular usando o hook atualizado.

## Compatibilidade

- Regras existentes (so com tabela_id) continuam funcionando identicamente -- `linha` e `produto_id` serao NULL, significando acesso total a tabela
- Administradores e supervisores continuam com acesso total
- Zero impacto no fluxo de aprovacao existente

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Adicionar colunas `linha` e `produto_id` na `user_price_table_access`, atualizar constraint unique |
| `src/hooks/useUserPriceTableAccess.ts` | Adicionar `canViewProduct()` e `filterProductsByAccess()` |
| `src/pages/GerenciamentoAcessoPrecos.tsx` | Adicionar selecao de escopo (Tabela/Linha/Produto) no dialog e badges na listagem |
| `src/components/fabrica/GeradorPrecosDialog.tsx` | Aplicar filtragem granular na exibicao de produtos |

## Resultado

Com essa estrutura voce podera, por exemplo:
- Dar acesso total a tabela Distribuidor para o Joao
- Dar acesso apenas a linha "Banana" na tabela E-commerce para a Maria
- Dar acesso apenas ao produto "Pistache Premium" na tabela Atacado para o Pedro

