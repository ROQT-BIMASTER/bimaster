

## Vincular Documentos China a Tarefas/Seções + Visualizar Documentos e Grade

### Contexto
A tela `ProjetoVincularChina` já vincula submissões a tarefas/seções, mas não permite vincular **documentos individuais** da China (da tabela `china_produto_documentos`) a tarefas específicas. O usuário quer:
1. Ao selecionar uma submissão, ver os **documentos categorizados** (usando `DOCUMENT_CATEGORIES`) e poder vinculá-los a tarefas
2. **Visualizar documentos** (preview de imagens/PDFs) diretamente na tela
3. **Visualizar a Grade** (cores/quantidades) do produto selecionado

### Alterações

#### 1. Nova tabela: `china_documento_tarefa_vinculos`
Mapeia documentos individuais da China a tarefas do projeto.

```sql
CREATE TABLE china_documento_tarefa_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES china_produto_documentos(id) ON DELETE CASCADE,
  tarefa_id UUID NOT NULL,
  secao_id UUID REFERENCES projeto_secoes(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(documento_id, tarefa_id)
);
-- RLS
ALTER TABLE china_documento_tarefa_vinculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage" ON china_documento_tarefa_vinculos FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

#### 2. Expandir `ProjetoVincularChina.tsx`
Adicionar uma **terceira seção** abaixo dos dois painéis atuais (ou como aba/accordion dentro do painel direito):

- **Painel de Documentos da Submissão**: Quando uma submissão é selecionada, exibir os documentos agrupados por `DOCUMENT_CATEGORIES`. Cada documento tem:
  - Nome + tipo + status (badge)
  - Botão **"Visualizar"** (abre preview em Dialog/Sheet — imagens inline, PDFs via iframe, outros via download)
  - **Checkbox para vincular** à tarefa selecionada no painel direito

- **Botão "Ver Grade"**: Quando submissão selecionada, exibir botão que abre um Dialog com `ChinaGradeView` mostrando cores, quantidades, pesos do produto (busca `china_produto_cores` da submissão)

#### 3. Hook: `useChinaDocumentoVinculos`
- `useDocumentosDaSubmissao(submissaoId)` — busca `china_produto_documentos` da submissão
- `useCoresDaSubmissao(submissaoId)` — busca `china_produto_cores` para a grade
- `useCreateDocVinculo()` / `useDeleteDocVinculo()` — CRUD na nova tabela
- `useDocVinculosExistentes(projetoId)` — lista vínculos doc↔tarefa

#### 4. Componente `ChinaDocPreviewDialog`
Dialog reutilizável que recebe `arquivo_url` e `tipo_documento`:
- Imagens: `<img>` com zoom
- PDFs: `<iframe>`
- Outros: link de download
- Usa signed URL do storage `china-documentos`

#### 5. Fluxo do usuário
1. Seleciona submissão China (esquerda)
2. Vê documentos categorizados + botão "Ver Grade" (centro/abaixo)
3. Seleciona projeto e tarefas (direita)
4. Vincula documentos específicos a tarefas específicas
5. Pode visualizar qualquer documento ou a grade sem sair da tela

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| Migration SQL | Nova tabela `china_documento_tarefa_vinculos` |
| `src/hooks/useChinaDocumentoVinculos.ts` | Novo hook para docs + cores + CRUD vínculos |
| `src/components/china/ChinaDocPreviewDialog.tsx` | Novo dialog de preview |
| `src/pages/ProjetoVincularChina.tsx` | Expandir com seção de documentos + grade |

