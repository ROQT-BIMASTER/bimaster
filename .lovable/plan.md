

## Plano: Reformular Grade com Tabela de Seleção, Filtros e Exportação PDF/Excel

### Contexto
Atualmente o editor de grade usa apenas uma barra de busca textual. O usuário quer:
1. Ver todos os produtos acabados em uma mini-tabela com filtros por Marca, Linha e busca
2. Selecionar produtos via checkbox e definir quantidade
3. Exportar a grade completa para PDF (impressão) ou Excel

### Dados disponíveis
- 21 produtos, todos marca MELU, com linhas: Banana, Game on, MELU - Sérum, Pistache
- Campos: id, nome, codigo, marca, linha, categoria, foto_url, codigo_barras_ean

### Alterações

**1. Reescrever `ComposicaoGradeEditor.tsx`** -- Substituir busca simples por:
- Barra de filtros: Select para **Marca** e **Linha** (valores distintos carregados do banco) + Input de busca textual
- Mini-tabela abaixo dos filtros mostrando produtos filtrados com colunas: Código, Nome, Linha, EAN, botão "+"
- Carregar todos os produtos elegíveis ao abrir (tipo != MP, != DISPLAY, ativo = true), filtrar no frontend
- Manter a lista de itens selecionados abaixo com quantidade editável, Nº cor e botão remover
- ScrollArea para a tabela (max ~200px) e para os itens selecionados (max ~200px)

**2. Adicionar exportação PDF ao `ExportarDisplayGrade.tsx`** -- Novo botão "Imprimir PDF" ao lado do Excel:
- Gerar HTML formatado com tabela da grade no mesmo layout do Excel
- Abrir em nova janela com `window.print()` para impressão/PDF nativo do navegador
- Colunas: Item No., Color No., Color Name, Qty, Type, Barcode, Proc Anvisa, NCM

**3. Atualizar `NovoProdutoAcabadoDialog.tsx`** -- Na aba Grade, mostrar dois botões de exportação (PDF + Excel) abaixo do editor quando houver itens na grade (mesmo antes de salvar, para preview)

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| `ComposicaoGradeEditor.tsx` | Reescrever: tabela de seleção com filtros Marca/Linha/Busca |
| `ExportarDisplayGrade.tsx` | Adicionar botão de impressão PDF via `window.print()` |
| `NovoProdutoAcabadoDialog.tsx` | Exibir botões PDF/Excel na aba Grade |

