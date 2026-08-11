# Comparativo de perfis: ordem de colunas, reordenação, exportação

## O que muda

### 1. Ordem padrão das colunas
A tabela passa a seguir a ordem comercial da cadeia, e não a ordem devolvida pelo banco:

```text
Produto | Custo Fábrica | Clear | Mude | Primavera | Deep | B2B | E-commerce
```

Tabelas que não estiverem nessa lista entram no fim, mantendo a ordem atual.

### 2. Mover colunas
Cada cabeçalho de tabela de preço ganha setas para mover a coluna para a esquerda/direita
(também por arrastar). Produto e Custo Fábrica ficam fixos no início.
A ordem escolhida é lembrada por usuário no navegador, então a tela reabre como foi deixada.

### 3. Exportar Excel
Botão "Excel" gera a planilha com exatamente as colunas na ordem exibida, uma linha por
produto e por perfil (Perfil A e Perfil B), com os valores em número (não texto) e as
colunas de diferença R$ e % quando houver Perfil B.

### 4. Imprimir PDF
Botão "PDF" gera o comparativo em paisagem, com cabeçalho (nome dos perfis, data/hora em
São Paulo), a tabela na ordem exibida e valores em `formatCurrency`.

## Detalhes técnicos

- `src/components/simulador/ComparativoPerfisTable.tsx`: novo estado `ordemColunas: string[]`
  derivado de uma constante `ORDEM_PADRAO` (match por nome via regex: fábrica/clear/mude/
  primavera/deep/b2b/e-commerce), persistido em `localStorage`
  (`simulador:comparativo:ordem-colunas`). Controles de mover no `TableHead`.
- Exportação Excel reutiliza `exportToExcel` de `@/utils/excelExport` (ExcelJS) — sem novas deps.
- PDF via `jspdf` + `jspdf-autotable`, já usados no projeto, em novo módulo
  `src/lib/fabrica/exportComparativoPerfis.ts` com as duas funções de exportação, mantendo o
  componente de UI enxuto.
- Sem alteração de cálculo: `perfilSimulacao.ts` e `cascataPricing.ts` ficam intactos.
- Bump de `APP_VERSION` e entrada no changelog em `src/pages/admin/ApiDocumentation.tsx`.
