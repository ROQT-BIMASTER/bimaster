

## Plano: Campo de Cor Visual nos Itens de Grade

### Contexto atual
A tabela `fabrica_produto_grade_itens` já possui o campo `cor_numero` (texto livre para "Nº da cor"). O editor de grade (`ComposicaoGradeEditor`) exibe apenas um input de texto estreito para esse número. Não há campo para nome da cor nem seletor visual de cor (hex).

### O que será feito

**1. Migração de banco — adicionar coluna `cor_hex`**
- Adicionar `cor_hex TEXT` à tabela `fabrica_produto_grade_itens` para armazenar o código hexadecimal da cor selecionada (ex: `#FF5733`)

**2. Atualizar interface `GradeItem` e persistência**
- Adicionar `cor_hex?: string` na interface `GradeItem` em `ComposicaoGradeEditor.tsx`
- Garantir que o campo seja salvo/carregado no `NovoProdutoAcabadoDialog.tsx`

**3. Reformular coluna "Nº Cor" no editor de grade**
Substituir o input simples por uma célula mais rica contendo:
- **Input de texto** para o nome/número da cor (ex: "Rosa Quartzo", "01")
- **Swatch de cor clicável** (quadradinho colorido) que abre um **Popover com color picker**
- O color picker terá: uma paleta de cores pré-definidas comuns (12-16 cores) + input hex livre para cores personalizadas
- O swatch exibe a cor selecionada; se nenhuma, mostra um ícone de paleta

**4. Exibição da cor nos componentes de visualização**
- `DisplayGradePopover`: mostrar o swatch de cor ao lado do nome do item
- `ComposicaoGradeCard`: exibir swatches coloridos no resumo compacto
- Exportação Excel: incluir coluna "Cor" com o nome e preencher o fundo da célula com o hex

**5. Impressão**
- Na função `handlePrint` do `DisplayGradePopover`, incluir coluna "Cor" com um quadrado colorido inline

### Detalhes técnicos

**Color Picker** — componente leve customizado (sem dependência externa):
```
┌──────────────────────────┐
│  Cores rápidas (grid)    │
│  🔴🟠🟡🟢🔵🟣⚫⚪     │
│  🩷🩵🤎🟤 ...           │
│ ─────────────────────── │
│  Hex: [#______] [✓]     │
└──────────────────────────┘
```

**Arquivos a criar:**
- `src/components/fabrica/ColorPickerPopover.tsx` — componente reutilizável de seleção de cor

**Arquivos a editar:**
- Migration SQL — `ALTER TABLE ... ADD COLUMN cor_hex`
- `src/components/fabrica/ComposicaoGradeEditor.tsx` — interface + UI da célula de cor
- `src/components/fabrica/NovoProdutoAcabadoDialog.tsx` — persistir `cor_hex`
- `src/components/fabrica/DisplayGradePopover.tsx` — exibir swatch na visualização e impressão
- `src/components/fabrica/ComposicaoGradeCard.tsx` — exibir swatches no resumo

