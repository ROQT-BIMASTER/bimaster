

# Equiparar Sistema de Grade China ao da Fábrica Brasil

## Problema
A tabela `china_produto_cores` é simplista: apenas `grupo`, `cor_nome`, `quantidade`. Faltam campos essenciais que a fábrica Brasil já tem: **cor_hex** (cor visual), **cor_numero** (identificação), **ordem** (sequência), **codigo_barras_ean**, e **codigo_produto** (código do item filho). A UI da China não oferece edição rica de cores — é apenas um preview estático parseado do Excel.

## Solução

### 1. Migração SQL — Enriquecer `china_produto_cores`

Adicionar colunas à tabela existente para paridade com `fabrica_produto_grade_itens`:

```sql
ALTER TABLE china_produto_cores
  ADD COLUMN cor_hex text,
  ADD COLUMN cor_numero text,
  ADD COLUMN ordem integer DEFAULT 0,
  ADD COLUMN codigo_barras_ean text,
  ADD COLUMN codigo_produto text,
  ADD COLUMN foto_url text;
```

### 2. Componente: `ChinaGradeEditor.tsx`

Editor visual bilíngue (PT/CN) inspirado no `ComposicaoGradeEditor` do Brasil, mas simplificado para os operadores chineses:

- **Tabela de itens** com colunas: Ordem, Cor (swatch hex + ColorPicker), Nome/Número da Cor, Código do Produto, EAN, Quantidade, Foto
- **Drag-and-drop** para reordenar (usando @dnd-kit já instalado)
- **ColorPickerPopover** reutilizado do Brasil (24 presets + custom hex)
- **Botão "Adicionar Cor"** para adicionar linhas manualmente (não depender apenas do Excel)
- Labels bilíngues em todas as colunas
- Totalizador no rodapé

### 3. Componente: `ChinaGradeView.tsx`

Visualização compacta (read-only) equivalente ao `DisplayGradePopover` do Brasil:
- Swatches de cor com hex
- Código, nome, EAN, quantidade
- Botão de imprimir (mesmo padrão do Brasil)
- Labels bilíngues

### 4. Atualizar `ChinaExcelPreview.tsx`

O preview de cores atualmente mostra apenas nome e grupo. Atualizar para exibir swatch de cor quando `cor_hex` estiver disponível.

### 5. Integração no Wizard (`ChinaNovaSubmissao.tsx`)

- Após o parse do Excel (step 1), as cores são salvas com os novos campos
- No step 2, adicionar uma seção "Grade de Cores 颜色网格" com o `ChinaGradeEditor` para a China editar/completar as cores (adicionar hex, EAN, reordenar)
- Substituir a simples lista de cores por um editor funcional

### 6. Integração no `ChinaRecebimentos.tsx` e `ChinaOrdemDetalhe.tsx`

- Substituir a listagem simples de cores pelo `ChinaGradeView` (read-only com swatches)
- No progresso por cor, mostrar o swatch hex ao lado do nome

### 7. Atualizar `ChinaOrdemProgress.tsx`

Adicionar swatch de cor visual ao lado do nome de cada cor nas barras de progresso.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar: novos campos em `china_produto_cores` |
| `src/components/china/ChinaGradeEditor.tsx` | Criar: editor de grade bilíngue com drag-and-drop + color picker |
| `src/components/china/ChinaGradeView.tsx` | Criar: visualização read-only com swatches + impressão |
| `src/components/china/ChinaExcelPreview.tsx` | Editar: exibir swatch hex |
| `src/pages/ChinaNovaSubmissao.tsx` | Editar: integrar editor de grade no wizard |
| `src/pages/ChinaRecebimentos.tsx` | Editar: usar ChinaGradeView |
| `src/pages/ChinaOrdemDetalhe.tsx` | Editar: usar ChinaGradeView + swatches no progresso |
| `src/components/china/ChinaOrdemProgress.tsx` | Editar: adicionar swatches de cor |

