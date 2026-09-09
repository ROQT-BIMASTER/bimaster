# Estoque do fornecedor: exportar em Excel e filtrar por fornecedor

## O que muda na tela

### 1. Filtro por fornecedor (Nélida, Fabulous, Bio-Sinergia)
Hoje existe um botão chamado "Todas as empresas" — ele já filtra exatamente por fornecedor (Nélida do Brasil, Bio-Sinergia e Fabulous Cosméticos), mas o nome não deixa isso claro e a lista mostra um número técnico ao lado do nome.

Ajustes:
- Botão passa a se chamar "Todos os fornecedores" / nome do fornecedor escolhido / "N fornecedores".
- Título da lista passa a ser "Fornecedor" e cada opção mostra só o nome, sem o código.
- A coluna "Empresa" da tabela passa a se chamar "Fornecedor" e deixa de exibir o número abaixo do nome.
- Continua permitindo marcar mais de um fornecedor ao mesmo tempo e entra no botão "Limpar" junto com os demais filtros.

### 2. Botão "Exportar Excel"
Novo botão ao lado de "Colunas", no topo da tela.

- Exporta **todos os itens do recorte atual** (todos os filtros aplicados: busca, fornecedor, filiais, status, categoria, linha, período, casado/não casado, só com saldo), não apenas a página visível.
- Enquanto gera, mostra estado de carregando; ao final, avisa quantos itens foram exportados.
- Limite de segurança de 20.000 linhas; acima disso pede para refinar os filtros.

### 3. Formatação profissional da planilha
Arquivo `estoque-fornecedor_AAAA-MM-DD.xlsx` com duas abas:

**Aba "Estoque fornecedor"**
- Linha de título com o nome do relatório, data/hora de geração (horário de São Paulo) e um resumo dos filtros aplicados.
- Cabeçalho em faixa escura, texto branco em negrito, congelado ao rolar e com filtro automático ativado.
- Colunas: Fornecedor, EAN caixa, Cód. Futura, Descrição, Status, Categoria, Linha, Estoque forn. (CX), Validade, Prazo (dias), Casado, Origem do casamento, Nosso código, SKU, Nome comercial, Disponível (CX), Disponível (UN), uma coluna de CX e outra de UN para cada filial e, ao final, Total CX / Total UN.
- Números com separador de milhar, casas decimais coerentes (CX com 1 casa, UN inteiro), datas em dd/MM/aaaa, larguras ajustadas e zebrado nas linhas.
- Validade vencida em vermelho e a vencer em até 90 dias em âmbar, igual à tela.
- Linha de totais ao final, em negrito.

**Aba "Resumo"**
- Filtros aplicados, total de itens, itens casados e percentual, caixas no fornecedor, disponível nosso em CX e UN e cobertura, além de totais por fornecedor e por filial.

## Detalhes técnicos

- `src/pages/estoque/FornecedorEstoquePage.tsx`: rótulos do filtro/coluna e novo botão de exportação.
- Novo `src/components/estoque/fornecedor/FornecedorExportButton.tsx`: recebe os filtros atuais, busca as linhas e dispara a geração.
- Novo `src/lib/estoque/exportFornecedorEstoque.ts`: montagem do workbook com ExcelJS (mesma dependência já usada em `src/utils/excelExport.ts`), estilos, colunas dinâmicas por filial e aba de resumo.
- Nova função no hook `src/hooks/estoque/useFornecedorIntegrado.ts` que reaproveita exatamente os mesmos filtros de `useFornecedorIntegradoList`, paginando em lotes de 1.000 linhas até o limite de 20.000.
- Sem alterações de banco de dados; a exportação lê a mesma visão já usada pela tela e respeita as permissões vigentes.
