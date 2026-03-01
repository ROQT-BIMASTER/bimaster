

## Validação Completa e Melhorias Sugeridas

### Status Atual

**Banco de dados**: Schema correto — tabela `fabrica_produto_grade_itens` com 7 colunas (id, produto_pai_id, produto_filho_id, quantidade, ordem, created_at, cor_numero). RLS ativo com políticas para CRUD. Campos `tipo_rotulagem` e `processo_anvisa` existem em `fabrica_produtos`. Nenhum dado de grade ainda (0 registros), 21 produtos todos tipo ACABADO.

**Componentes**: Todos os 5 arquivos principais existem e estão funcionais:
- `ComposicaoGradeEditor.tsx` — busca, adiciona, remove, quantidade, cor_numero, filtro anti-DISPLAY ✅
- `ComposicaoGradeCard.tsx` — modo compact (badge) e full (lista com thumbnails) ✅
- `ExportarDisplayGrade.tsx` — Excel com header azul, hyperlinks de foto, bordas ✅
- `NovoProdutoAcabadoDialog.tsx` — aba Grade condicional, limpeza ao trocar tipo, tipo_rotulagem ✅
- `ProdutoDetalhesSheet.tsx` — grade card + export button + "usado em displays" reverso ✅

### Problemas Encontrados

1. **Export Excel — `item_no` só na última linha**: O código coloca o código do display apenas na última linha (`isLast`). Na planilha de referência, o código aparece em TODAS as linhas do grupo. Precisa corrigir.

2. **Export Excel — `qty_per_box` individual ausente**: Cada linha deveria mostrar a quantidade daquela variante. Atualmente só mostra o total na última linha. Falta a quantidade individual por item.

3. **Export Excel — colunas "Color/Commercial name" duplicadas**: As duas colunas têm o mesmo header "Color/Commercial name" mas keys diferentes (`cor_numero` e `cor_nome`). Na planilha original o header é diferenciado (número vs nome).

4. **`tipo_rotulagem` só aparece no DISPLAY**: O campo "Tipo de Rotulagem" está condicionado a `formData.tipo === "DISPLAY"`, mas cada **produto filho** individual também pode ter seu próprio tipo. O export já tenta ler `filho?.tipo_rotulagem`, mas não há UI para definir isso em produtos ACABADO.

5. **Busca por EAN ausente no editor de grade**: O `ComposicaoGradeEditor` busca por `nome` e `codigo`, mas não por `codigo_barras_ean`. Sendo que EAN é fundamental para kits, deveria ser incluído.

6. **Sem validação de grade vazia ao salvar DISPLAY**: É possível salvar um produto DISPLAY sem nenhum item na grade. Deveria ter um warning ou bloqueio.

### Plano de Melhorias

| # | Melhoria | Arquivo | Ação |
|---|---|---|---|
| 1 | Corrigir `item_no` em todas as linhas do Excel | `ExportarDisplayGrade.tsx` | Colocar `displayProduto.codigo` em cada linha, não só na última |
| 2 | Mostrar `quantidade` individual por linha + total na última | `ExportarDisplayGrade.tsx` | Cada linha mostra `item.quantidade`, última linha mostra `totalQty` como "Total" |
| 3 | Diferenciar headers de cor | `ExportarDisplayGrade.tsx` | Renomear para "Color No." e "Color/Commercial Name" |
| 4 | Mover `tipo_rotulagem` para todos os tipos de produto | `NovoProdutoAcabadoDialog.tsx` | Remover a condição `tipo === "DISPLAY"` do campo tipo_rotulagem |
| 5 | Incluir EAN na busca do editor | `ComposicaoGradeEditor.tsx` | Adicionar `codigo_barras_ean.ilike` no `.or()` |
| 6 | Warning ao salvar DISPLAY sem grade | `NovoProdutoAcabadoDialog.tsx` | Adicionar `toast.warning` no `handleSubmit` se tipo=DISPLAY e gradeItems vazio |
| 7 | Adicionar linha de rodapé "TOTAL" no Excel | `ExportarDisplayGrade.tsx` | Linha extra com soma total, fundo cinza claro |

