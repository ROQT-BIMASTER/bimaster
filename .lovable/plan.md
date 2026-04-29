# Card "Código" = Order Number + novo campo "Linha do Produto"

## Mudança 1 — Card "Código" passa a exibir `numero_ordem`

Em `src/components/china/ChinaExcelPreview.tsx` (linhas 56–60), o card
"Código / 编号" hoje mostra `data.produto_codigo`. Trocar para
`data.numero_ordem` (Order Number da planilha).

```tsx
<InfoCard
  icon={<Package className="h-5 w-5 text-primary" />}
  labelPt="Código (Projeto)" labelCn="项目编号"
  value={data.numero_ordem || "—"}
/>
```

O `produto_codigo` (Item MUB) continua existindo no estado e no banco, só
deixa de ocupar esse card. Se quisermos mantê-lo visível, ele já aparece em
outros cards (Item NUB, EANs etc.) — não precisa duplicar aqui.

## Mudança 2 — Novo campo obrigatório "Linha do Produto"

### 2.1 Banco
Migration:
```sql
ALTER TABLE public.china_produto_submissoes
  ADD COLUMN linha_produto text;
-- nullable (compat com registros antigos), obrigatoriedade vive no formulário
```

### 2.2 Tipo (frontend)
Em `ChinaExcelPreview.tsx` interface `ExcelData` e em
`ChinaDataValidationDialog.tsx` adicionar `linha_produto?: string`.

### 2.3 UI no preview (Step 0)
Adicionar 5º card editável inline no grid de info:

```tsx
<InfoCard
  editable
  required
  icon={<Tag className="h-5 w-5 text-primary" />}
  labelPt="Linha do Produto" labelCn="产品线"
  value={data.linha_produto || ""}
  placeholder="Ex.: Lip, Eye, Face"
  onChange={(v) => onUpdate?.({ ...data, linha_produto: v })}
/>
```

Estender `InfoCard` para aceitar opcionalmente `editable + onChange`
renderizando um `Input` ao invés de `<p>`. Mostrar borda destrutiva quando
`required && !value`.

### 2.4 UI no diálogo de validação
Em `ChinaDataValidationDialog.tsx`, na seção de identificação do produto
(perto de Código/Fórmula/Item), adicionar:

```tsx
<div>
  <Label>Linha do Produto 产品线 <span className="text-destructive">*</span></Label>
  <Input
    value={data.linha_produto || ""}
    onChange={(e) => setData(d => ({ ...d, linha_produto: e.target.value }))}
    placeholder="Ex.: Lip, Eye, Face"
  />
</div>
```

E em `handleConfirm`, bloquear se `!data.linha_produto?.trim()`:

```ts
if (!data.linha_produto?.trim()) {
  toast.error("Informe a Linha do Produto. 请填写产品线。");
  return;
}
```

### 2.5 Persistência
Em `src/pages/ChinaNovaSubmissao.tsx` (linha ~240, `submissaoPayload`):

```ts
linha_produto: validatedData.linha_produto || null,
```

E em `handleManualEntry` (busca por `manualMode`) acrescentar o mesmo campo no
formulário manual + payload.

## Validação manual

1. Importar planilha. Card "Código (Projeto)" mostra o `numero_ordem`
   (ex.: o número do projeto), não mais o Item MUB.
2. Aparece um 5º card "Linha do Produto" vazio com borda vermelha.
3. Clicar no card e digitar (ex.: "Lip"). Borda fica neutra.
4. Tentar Confirmar Dados sem linha → toast de erro.
5. Preencher e confirmar → salva em `china_produto_submissoes.linha_produto`.

## Arquivos afetados

- Migration: `ADD COLUMN linha_produto`.
- `src/components/china/ChinaExcelPreview.tsx` — troca do valor do card
  Código + novo card editável Linha + extensão do `InfoCard`.
- `src/components/china/ChinaDataValidationDialog.tsx` — novo input + validação
  no `handleConfirm` + tipo.
- `src/pages/ChinaNovaSubmissao.tsx` — incluir `linha_produto` no payload de
  insert/update e no fluxo manual.
- `supabase/functions/parse-china-excel/index.ts` — sem mudança (campo é
  inserido manualmente, não vem da planilha).
