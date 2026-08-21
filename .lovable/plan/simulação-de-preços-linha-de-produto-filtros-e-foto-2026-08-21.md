# Simulação de preços: linha de produto, filtros e foto

## O que muda

### 1. Linha de produto no produto hipotético
Cada linha da grade de produtos hipotéticos ganha o campo **Linha** (Baunilha, MELU, Wander, etc.),
escolhido em uma lista das linhas já existentes no catálogo, com possibilidade de digitar uma linha nova
para simulações de lançamento. A linha é apenas um rótulo da simulação — nada é gravado no catálogo.

### 2. Filtro e agrupamento por linha
Acima do comparativo entra uma barra de filtros:

- **Linha** (multi-seleção, mesmo padrão do seletor de linhas usado em Estoque)
- **Busca** por descrição do produto
- Chave **Agrupar por linha**: quando ligada, o comparativo exibe um cabeçalho por linha com
  subtotal/média de markup efetivo da linha; quando desligada, mantém a tabela plana atual.

Os filtros valem também para a exportação em Excel e PDF (exporta o que está na tela), e a linha
entra como coluna nos dois formatos.

### 3. Foto do produto
Cada produto hipotético pode ter uma miniatura, obtida de duas formas:

- **Importar de produto existente**: ao usar um produto do catálogo como ponto de partida, a foto,
  a linha e a descrição vêm junto (sem criar vínculo nem alterar o catálogo).
- **Enviar imagem**: upload direto na linha da grade, com as mesmas validações de segurança de
  arquivo já usadas no sistema (tipo real por magic bytes, limite de tamanho).

A miniatura aparece na grade de produtos hipotéticos e na primeira coluna do comparativo, e é
incluída no PDF exportado (no Excel entra como coluna de referência textual, sem imagem embutida).

## Detalhes técnicos

- `ProdutoHipotetico` (`src/lib/fabrica/perfilSimulacao.ts`) ganha `linha?: string | null` e
  `foto_url?: string | null`. Cálculo de cascata permanece intacto.
- `ProdutosHipoteticosGrid.tsx`: colunas Foto / Descrição / Linha / Valor / Nível, botão de importar
  produto do catálogo (consulta `fabrica_produtos` com `linha`, `foto_url`, `custo_total`) e
  `ProductThumbnail` para render/resolução de URL assinada.
- Novo hook `useLinhasProdutos` lendo `distinct linha` de `fabrica_produtos` (ativos).
- `ComparativoPerfisTable.tsx`: estado de filtros (linhas, busca, agrupar) persistido em
  `localStorage` por usuário, como já é feito com ordem/ocultação de colunas; renderização em
  grupos quando "agrupar" estiver ativo.
- `exportComparativoPerfis.ts`: acrescenta a coluna Linha e recebe as linhas já filtradas;
  no PDF, cabeçalho de grupo por linha.
- Upload no bucket privado `fabrica-produto-fotos` sob prefixo `<uid>/simulador/...`, reutilizando
  o `uploadCore`/validação de arquivos existente. Migration só de policy de storage, caso o prefixo
  do usuário ainda não esteja coberto — sem novas tabelas.
- Bump de `APP_VERSION` + entrada no changelog em `ApiDocumentation.tsx`.

## Fora de escopo
Salvar a simulação com fotos como registro persistente e promover simulação a preço oficial.
