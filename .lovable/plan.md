

# Vincular China + Projeto no Checklist Etiqueta/Bula

## Resumo

Refatorar o diálogo "Novo Checklist" da Etiqueta/Bula para incluir o seletor de submissões vinculadas (mesmo padrão da Análise de Embalagem), permitindo importar dados do Vincular China e pré-visualizar documentos. Também garantir que a listagem principal filtre apenas itens vinculados.

## Alterações

### 1. `NewEtiquetaDialog` — Seletor de submissões vinculadas

- Adicionar toggle "Importar do Vincular China" / "Preenchimento Manual" (mesmo padrão do `NewAnaliseDialog`)
- No modo vinculado: buscar submissões da `china_submissao_tarefa_vinculos` → `china_produto_submissoes`
- Ao selecionar: auto-preencher `sku` (produto_codigo), `produto_nome`, `linha_marca` (formula_codigo) e salvar `submissao_id` no form
- Preview de documentos vinculados (busca em `china_produto_documentos`)
- Manter modo manual como fallback

### 2. Hook `useCreateEtiqueta` — incluir `submissao_id`

- O `produto_etiqueta_bula` já possui coluna `submissao_id` — garantir que o create passe esse campo

### 3. Listagem principal — filtro por vínculos

- Filtrar etiquetas para exibir apenas aquelas cujo `submissao_id` está na tabela `china_submissao_tarefa_vinculos` (consistente com Recebimento de Amostra e Análise de Embalagem)

## Arquivo

| Arquivo | Ação |
|---------|------|
| `src/pages/ChecklistEtiquetaBula.tsx` | Refatorar `NewEtiquetaDialog` com seletor vinculado + filtrar listagem |

## Fluxo

```text
[Novo Checklist] → Dialog abre
  → Tab "Importar do Vincular China": cards de submissões vinculadas
  → Selecionar → auto-preenche SKU, Produto, Linha + preview docs
  → [Criar Checklist]
```

