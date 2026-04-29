# Auditoria de Código + Linha do Produto + Exportação de Conferência

## Objetivo

Quatro frentes solicitadas:
1. Exportar relatório (Código/Projeto + Linha do Produto) para conferência rápida pós-importação.
2. Auditar o card "Código (Projeto)" para garantir que seja **sempre** `numero_ordem`, sem cair em `produto_codigo` (Item MUB).
3. Validar caracteres permitidos em Linha do Produto e mostrar erro claro quando vazio/ inválido.
4. Confirmar que `linha_produto` salva e **rehidrata** ao reabrir submissão.

---

## 1. Card "Código (Projeto)" — auditoria de mapeamento

### Achados
- `ChinaExcelPreview.tsx` linha 60 já usa `data.numero_ordem` ✅
- **Gap 1**: `ChinaNovaSubmissao.tsx` linha 671 mostra um "preview do produto" no topo dos steps 1+ exibindo `productInfo.produto_codigo` como o código principal — quando deveria mostrar `numero_ordem` também (consistência). `numero_ordem` já aparece, mas em segundo plano.
- **Gap 2**: `ChinaDataValidationDialog.tsx` linha 334 rotula o input como "Código (Item MUB) 编号" — texto correto, mas precisa confirmar que esse não é confundido com o card "Código (Projeto)" do preview. Manter rótulo explícito ("Item MUB") evita ambiguidade.

### Mudança
- Em `ChinaNovaSubmissao.tsx` (preview collapsível, linha ~669-672): trocar o título principal para `numero_ordem` (Projeto) e mover `produto_codigo` para subtítulo com label "Item MUB". Isso alinha 100% com o card do preview Step 0.
- Adicionar comentário em `ChinaExcelPreview.tsx` deixando explícito: `// Card Código = numero_ordem (PROJETO). Nunca usar produto_codigo aqui (é Item MUB).`

---

## 2. Linha do Produto — validação de caracteres + mensagens

### Regra proposta
- Permitido: letras (incluindo acentos), números, espaço, hífen, barra `/` e vírgula.
- Tamanho: 1–60 caracteres após `trim()`.
- Regex: `/^[\p{L}\p{N}\s\-\/,]{1,60}$/u`

### Onde aplicar
- **Schema Zod** novo em `src/lib/validations/china-submissao.ts`:
  ```ts
  export const linhaProdutoSchema = z.string()
    .trim()
    .min(1, "Informe a Linha do Produto.")
    .max(60, "Linha do Produto deve ter até 60 caracteres.")
    .regex(/^[\p{L}\p{N}\s\-\/,]+$/u, "Use apenas letras, números, espaço, hífen, barra ou vírgula.");
  ```
- **`ChinaDataValidationDialog.tsx`** `handleConfirm` (linhas 271-294): substituir o `if (!data.linha_produto?.trim())` por `linhaProdutoSchema.safeParse(...)` e exibir `result.error.issues[0].message` no `toast.error`. Adicionar estado `linhaProdutoError` para exibir mensagem inline embaixo do input (linhas 353-363) com `text-xs text-destructive`.
- **`ChinaExcelPreview.tsx`** `InfoCard` editável (linhas 77-85): validar onChange e marcar borda destrutiva + tooltip/legenda quando inválido (estender `InfoCard` para aceitar `errorMessage?: string`).
- **`ChinaNovaSubmissao.tsx`** `handleValidationConfirm` (linha 230) e form manual (linha 410): rodar o mesmo schema antes do insert como guardrail.

---

## 3. Persistência + rehidratação

### Achados
- Insert OK em `ChinaNovaSubmissao.tsx` linha 246 (`linha_produto: validatedData.linha_produto || null`).
- **Gap (rehidratação)**: linha 120 — quando carrega `existingSubmissao` para editar, faz `setParsedData(existingSubmissao.dados_excel || { produto_codigo, produto_nome })`. Se `dados_excel` não tiver `linha_produto` (registros antigos ou edição parcial), o campo volta vazio mesmo estando salvo na coluna dedicada `linha_produto`.
- Form manual (linhas 860-910) hoje **não tem campo Linha do Produto** — quem entra por entrada manual nunca preenche.

### Mudança
- `useEffect` de hidratação (linha 118-131): mesclar `linha_produto` da coluna dedicada por cima do `dados_excel`:
  ```ts
  setParsedData({
    ...(existingSubmissao.dados_excel || {}),
    produto_codigo: existingSubmissao.produto_codigo,
    produto_nome: existingSubmissao.produto_nome,
    numero_ordem: existingSubmissao.numero_ordem ?? existingSubmissao.dados_excel?.numero_ordem,
    linha_produto: existingSubmissao.linha_produto ?? existingSubmissao.dados_excel?.linha_produto,
  });
  ```
- Adicionar input "Linha do Produto" obrigatório no formulário manual (perto da linha 905) e incluir `linha_produto` no payload manual (linha 423).
- Validar no `handleManualEntry` com o mesmo `linhaProdutoSchema`.

### Verificação visual após salvar
- Após `handleValidationConfirm` salvar, `setParsedData(validatedData)` (linha 235) já mantém `linha_produto` na UI. Adicionar refetch da query `existingSubmissao` (`queryClient.invalidateQueries(["china-submissao", id])`) para garantir reload da fonte da verdade após o upsert — assim o reabrir do modal mostra o valor persistido.

---

## 4. Exportação/Relatório de conferência

### UI
- Nova ação em `src/pages/ChinaOrdens.tsx` (header da página, junto ao `ManualFabricaDrawer`): botão "Exportar Conferência" (ícone `FileSpreadsheet`). Sem mexer no design existente além de adicionar o botão.
- Alternativamente (decidir no implement): colocar o botão também em `src/pages/ChinaNovaSubmissao.tsx` no card de preview pós-import para exportar **a submissão atual** rapidamente.

### Conteúdo do CSV/XLSX
Colunas mínimas pedidas para conferência rápida:
- `numero_ordem` → "Código (Projeto)"
- `linha_produto` → "Linha do Produto"
- `produto_codigo` → "Item MUB"
- `produto_nome` → "Produto"
- `formula_codigo` → "Fórmula"
- `qty_total` → "Qty Total"
- `ean_display`, `ean_caixa_master`
- `status`, `created_at`

### Implementação
- Reaproveitar `src/utils/excelExport.ts` (`exportToExcel`).
- Nova função `exportChinaSubmissoesConferencia(rows)` em `src/lib/china/exportConferencia.ts` com mapeamento das colunas e nome `conferencia_china_<YYYY-MM-DD>.xlsx`.
- Query: buscar de `china_produto_submissoes` os registros do mesmo dia/última importação (filtro padrão "últimos 7 dias", configurável depois). Em `ChinaOrdens` exportar todas as ordens visíveis.

### Ordenação
- Por `numero_ordem` ASC, depois `linha_produto` ASC — facilita conferência manual com a planilha original.

---

## Arquivos afetados

- **Novo**: `src/lib/validations/china-submissao.ts` (schema Zod `linhaProdutoSchema`).
- **Novo**: `src/lib/china/exportConferencia.ts` (função de export).
- `src/components/china/ChinaExcelPreview.tsx` — `InfoCard` aceita `errorMessage`; aplica validação onChange; comentário do mapeamento.
- `src/components/china/ChinaDataValidationDialog.tsx` — usa schema Zod, mensagem inline, mantém label "Item MUB".
- `src/pages/ChinaNovaSubmissao.tsx` — hidratação mesclando `linha_produto` da coluna; preview header passa a destacar `numero_ordem`; campo Linha do Produto no form manual; validação manual; invalidate da query após salvar; botão de exportação opcional.
- `src/pages/ChinaOrdens.tsx` — botão "Exportar Conferência".

## Validação manual

1. **Auditoria Código**: importar planilha → card "Código (Projeto)" mostra `numero_ordem`. No preview do step 1, o título também é `numero_ordem` (não `produto_codigo`).
2. **Validação Linha**: digitar `Lip!@#` → erro inline "Use apenas letras, números…". Apagar tudo → erro "Informe a Linha do Produto.". Confirmar bloqueado.
3. **Persistência/rehidratação**: preencher "Lip", confirmar, sair, reabrir submissão pelo Inbox → campo volta preenchido com "Lip" (validar tanto via `dados_excel` quanto via coluna dedicada).
4. **Exportação**: clicar "Exportar Conferência" em ChinaOrdens → baixa `.xlsx` com colunas Código (Projeto) + Linha do Produto + demais. Conferir contra a planilha original.
