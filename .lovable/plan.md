

## Plano: Exportação Excel de Kits/Displays + Campos Faltantes

### Análise da Imagem vs Sistema Atual

A planilha de referência possui estas colunas:

| Coluna da planilha | Existe no sistema? | Campo no banco |
|---|---|---|
| Item No. (código do display) | Sim | `fabrica_produtos.codigo` |
| Color/Commercial name (nº) | Parcial | `ordem` na grade, mas sem campo "número da cor" dedicado |
| Color/Commercial name (texto) | Sim | `nome` do produto filho |
| Picture | Sim | `foto_url` do produto filho |
| Picture of box (foto do display) | Sim | `foto_url` do produto pai |
| Item Name (nome do display) | Sim | `nome` do produto pai |
| Quantity of pieces per box | Sim | `itens_display` (soma das quantidades) |
| Type (sticker, etc.) | **Nao existe** | Precisa novo campo |
| Barcode NO. | Sim | `codigo_barras_ean` do produto filho |
| Batch NO. | **Parcial** | Existe `fabrica_lotes.codigo_lote`, mas não vinculado ao display diretamente |
| Production date | **Parcial** | `fabrica_lotes.data_fabricacao` |
| Expiry date | **Parcial** | `fabrica_lotes.data_validade` |
| Proc Anvisa | Sim | `fabrica_produtos.processo_anvisa` |
| NCM | Sim | `fabrica_produtos.ncm` |

### Campos que precisam ser adicionados

1. **`tipo_rotulagem`** (text) em `fabrica_produtos` -- Para o campo "Type" (sticker, label, sleeve, etc.)
2. **`cor_numero`** (text) em `fabrica_produto_grade_itens` -- Para numerar as cores/variantes dentro do display (1, 2, 3...)

O Batch NO., Production date e Expiry date são dados de **lote de produção**, não do cadastro do produto. Na exportação, esses campos serão opcionais (preenchidos manualmente ou via seleção de lote).

### Componente: `ExportarDisplayGrade.tsx`

Novo componente que será adicionado ao `ProdutoDetalhesSheet` quando o produto for tipo DISPLAY. Funcionalidade:

- Botão "Exportar Grade" no painel de detalhes do display
- Busca o display + todos os itens da grade com joins nos produtos filhos
- Gera planilha Excel no formato da imagem, com:
  - Linhas agrupadas por display (código do display só na última linha de cada grupo)
  - Colunas: Item No., Color No., Color Name, Item Name, Qty per box, Type, Barcode, Proc Anvisa, NCM
  - Batch, Production date, Expiry date como colunas vazias (para preenchimento manual ou futura integração com lotes)
  - Estilo: header com fundo azul, bordas, merge de células do display

### Migração SQL

```sql
ALTER TABLE fabrica_produtos ADD COLUMN IF NOT EXISTS tipo_rotulagem text;
ALTER TABLE fabrica_produto_grade_itens ADD COLUMN IF NOT EXISTS cor_numero text;
```

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Adicionar `tipo_rotulagem` e `cor_numero` |
| `ExportarDisplayGrade.tsx` | **Novo** -- exportação Excel no formato da imagem |
| `ProdutoDetalhesSheet.tsx` | Adicionar botão de exportação para produtos DISPLAY |
| `NovoProdutoAcabadoDialog.tsx` | Adicionar campo `tipo_rotulagem` (sticker/label/sleeve) |
| `ComposicaoGradeEditor.tsx` | Adicionar campo `cor_numero` editável por item da grade |

