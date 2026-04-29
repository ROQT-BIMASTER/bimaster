## Tela: Checklist de Embalagens 包装清单

Página dedicada acessada via botão na Ficha do Produto (China), com colunas-padrão editáveis, linhas por produto/cor (checkbox) e biblioteca de templates por cliente.

### 1. Rota e ponto de entrada

- Nova rota: `/dashboard/fabrica-china/produto/:id/checklist` registrada em `src/App.tsx` com `ScreenProtectedRoute screenCode="china_fichas"`.
- Botão **"Checklist de Embalagens 包装清单"** no header de `ChinaFichaProduto.tsx` (ao lado de "Despachar" / Manual), ícone `ListChecks`.

### 2. Layout da página (`ChinaProdutoChecklist.tsx`)

Reusa `ChinaPageShell` + `ChinaPageHeader` (showBack para a Ficha).

```text
┌─ Header: Checklist de Embalagens — {produto_codigo} ─────────────┐
│  [Salvar como template] [Carregar template ▾] [+ Coluna] [Salvar]│
├──────────────────────────────────────────────────────────────────┤
│ Produto │ Mockup │ Emb.Prim │ Sleeve │ Cartucho │ ... │ Emb.Tester│
│  (cor)  │  img   │   ☐     │   ☐    │    ☐    │     │     ☐    │
└──────────────────────────────────────────────────────────────────┘
```

- **Linhas:** uma por cor da grade (puxa de `china_produto_cores`); coluna "Produto" mostra `cor_nome` + `codigo_produto`; coluna "Mockup" permite upload de imagem por linha (bucket `china-documentos`, path `{submissao_id}/checklist/mockup/{cor_id}_{ts}`).
- **Colunas de itens:** apenas checkbox (toggle on/off). Cabeçalho editável inline (duplo clique para renomear) e botão `X` para remover. Botão **"+ Coluna"** abre prompt simples (nome PT / nome CN).
- **Padrão inicial** (criado on-the-fly se não houver checklist salvo) — exatamente os da foto, podendo ser editado depois:
  1. Embalagem primária / Primary Packaging
  2. Sleeve / Lacre / Shrink Sleeve
  3. Cartucho / Carton
  4. Vacuum Forming
  5. Display / Inner
  6. Etiqueta bula / Instruction sticker
  7. Etiqueta de fundo / Bottom sticker
  8. Etiqueta provador / Tester sticker
  9. Embalagem provador / Tester Packaging

### 3. Persistência

Checklist do produto é salvo em duas tabelas:

- `china_produto_checklist` (1 por submissão): `id`, `submissao_id` (FK), `colunas jsonb` (array `{key,label_pt,label_cn,ordem}`), `created_by`, timestamps.
- `china_produto_checklist_celulas`: `id`, `checklist_id`, `cor_id` (FK `china_produto_cores`), `coluna_key`, `marcado bool`, `mockup_path text`, timestamps. Índice único `(checklist_id, cor_id, coluna_key)`.

Templates por cliente:

- `china_checklist_templates`: `id`, `cliente_id` (FK), `nome`, `colunas jsonb` (mesmo formato), `created_by`, `created_at`. Visível para qualquer usuário do mesmo cliente (RLS via semi-join em `china_produto_submissoes`/`projetos` para validar pertencimento ao cliente). Botões "Salvar como template" e "Carregar template" usam essa tabela.

RLS: somente usuários China internos e Brasil internos com acesso ao módulo China (espelhar policies já usadas em `china_produto_documentos`).

### 4. Comportamento

- Ao abrir: tenta carregar checklist existente; se não houver, monta linhas a partir das cores e colunas-padrão (nada salvo até o usuário tocar uma célula → autosave debounced 600ms).
- "Salvar como template" → grava `colunas` atuais + nome digitado, vinculado ao `cliente_id` da submissão.
- "Carregar template" → dropdown listando templates do cliente; ao escolher, substitui o array `colunas` (preserva células marcadas cujas `coluna_key` ainda existem).
- Exportação: botão "Exportar XLSX" reaproveita `src/lib/excel-utils.ts` (formato igual à foto).
- Apenas usuários Brasil podem editar quando submissão `status in ('aprovado','arte_enviada')`; China edita em rascunho. Hook `useUIPermissions("china_ficha")` controla.

### 5. Detalhes técnicos

- Componentes novos:
  - `src/pages/ChinaProdutoChecklist.tsx` (página)
  - `src/components/china/ChecklistEmbalagensTable.tsx` (tabela editável)
  - `src/components/china/ChecklistTemplateMenu.tsx` (salvar/carregar)
  - `src/hooks/useChinaProdutoChecklist.ts` (queries + mutations + autosave)
- Tokens semânticos do design system; cabeçalho da tabela com `bg-destructive/10` para evocar o vermelho da referência sem hardcode.
- Upload de mockup usa `uploadAndGetSignedUrl` + preview via `StoragePreviewDialog`.
- Validação Zod `.strict()` para payloads de mutation; sem `window.open` para downloads.

### 6. Migrations (uma só)

Cria as 3 tabelas acima com RLS, índices e trigger `update_updated_at_column`. Nenhum dado seed.

### 7. Fora de escopo

- Nada de OCR/IA para preencher checklist a partir de PDF.
- Sem versionamento histórico (apenas snapshot via "Salvar como template").
- Sem alteração nas telas existentes além do botão de entrada na Ficha.
