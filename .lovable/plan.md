

## Diagnóstico e Plano

### O que já está implementado (confirmado no código)

Todas as alterações anteriores estão no código:
- `ComposicaoGradeEditor.tsx`: filtro `.neq("tipo", "DISPLAY")`, busca por EAN, campo `cor_numero`
- `NovoProdutoAcabadoDialog.tsx`: aba Grade condicional, limpeza ao trocar tipo, `tipo_rotulagem` para todos os tipos, warning de grade vazia
- `ExportarDisplayGrade.tsx`: exportação Excel completa com headers diferenciados, qty individual, linha TOTAL
- `ProdutoDetalhesSheet.tsx`: card de grade, botão exportar, "Usado em Displays" reverso

O motivo provável de "não encontrar" é que **nenhum produto está cadastrado como tipo DISPLAY** no banco (todos os 21 produtos são tipo ACABADO). As funcionalidades só aparecem ao selecionar tipo "Display / Kit" no cadastro de produto.

### Plano: Manual completo sobre Displays

| Ação | Arquivo |
|---|---|
| Adicionar seção "Displays / Kits" ao ManualFabricaDrawer | `ManualFabricaDrawer.tsx` |
| Adicionar seção "Displays / Kits" ao FabricaManualPage | `FabricaManualPage.tsx` |
| Adicionar seção ao manual contextual de Produtos Acabados explicando como acessar as funcionalidades de Display | `ManualFabricaDrawer.tsx` (seção "produtos-acabados") |

### Conteúdo do Manual de Displays

O manual cobrirá:
1. **O que é um Display/Kit** -- conceito e quando usar
2. **Como criar** -- passo a passo completo (tipo DISPLAY, aba Grade, busca de produtos, cor/número, quantidade)
3. **Tipo de Rotulagem** -- sticker, label, sleeve, tag
4. **Composição de Grade** -- adicionar/remover produtos, campo Nº da cor, quantidade por variante
5. **Regras e validações** -- não permite DISPLAY dentro de DISPLAY, warning de grade vazia, limpeza ao trocar tipo
6. **Exportação Excel** -- formato da planilha, colunas, linha TOTAL, como usar
7. **Rastreabilidade reversa** -- "Usado em Displays" no painel de detalhes
8. **Exemplo prático completo** -- Display com 3 variantes, exportação Excel
9. **Fluxo recomendado** -- cadastrar produtos → criar Display → montar grade → exportar

