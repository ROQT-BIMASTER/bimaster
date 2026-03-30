

# Permitir Upload de Planilha de Referência para Sugestão IA

## Resumo

Adicionar a opção de upload de planilha (.xlsx, .xls, .csv) no painel de sugestão IA do builder. A planilha será lida no frontend, convertida em texto (cabeçalhos + primeiras linhas) e enviada junto com a descrição para a edge function gerar campos baseados na estrutura do documento.

## Abordagem

A leitura da planilha será feita no frontend usando a biblioteca `exceljs` (já instalada no projeto — `src/lib/excel-utils.ts`). Os dados extraídos (cabeçalhos + amostra de 5 linhas) serão enviados como texto no campo `description` para a edge function, sem necessidade de alteração no backend.

## Alterações

### 1. `src/pages/DynamicFormBuilder.tsx`

- Adicionar estado `aiSpreadsheetData` (string | null) para armazenar o texto extraído da planilha
- Adicionar estado `aiSpreadsheetName` (string | null) para exibir o nome do arquivo
- Criar função `handleSpreadsheetUpload`:
  - Aceitar `.xlsx`, `.xls`, `.csv`
  - Usar `ExcelJS.Workbook` para ler o arquivo
  - Extrair cabeçalhos + primeiras 5 linhas de cada aba
  - Formatar como texto: `"Planilha: [nome]. Aba [X]: Colunas: A, B, C. Linhas exemplo: [...]"`
  - Salvar no estado
- No painel IA, adicionar botão "Enviar planilha de referência" ao lado do botão de imagem existente
  - Input file accept=`.xlsx,.xls,.csv`
  - Quando carregado, mostrar badge com nome do arquivo + botão X para remover
- Na função `handleSuggestAI`, concatenar `aiSpreadsheetData` ao `description` enviado para a edge function

### 2. `supabase/functions/suggest-form-fields/index.ts`

- Atualizar o system prompt para incluir instrução: "Se dados de planilha forem fornecidos, use os cabeçalhos e dados de exemplo para inferir os tipos de campo corretos (texto, número, data, select, etc.)"
- Sem mudança estrutural — os dados da planilha chegam como texto no campo `description`

## Fluxo

```text
Usuário seleciona planilha (.xlsx) →
  Frontend lê com ExcelJS →
  Extrai: "Colunas: Nome, Preço, Quantidade, Categoria. Exemplo: João, 15.90, 3, Bebidas" →
  Envia como parte do description para suggest-form-fields →
  IA retorna campos tipados (text, price, number, select com opções)
```

| Arquivo | Ação |
|---------|------|
| `src/pages/DynamicFormBuilder.tsx` | Adicionar upload de planilha + extração |
| `supabase/functions/suggest-form-fields/index.ts` | Atualizar system prompt |

