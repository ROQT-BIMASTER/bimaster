

# Vincular China no Motor de Artes

## Resumo

O diálogo "Novo Checklist de Arte" no Motor de Artes atualmente é 100% manual. Adicionar o seletor de submissões vinculadas (mesmo padrão já implementado em Análise de Embalagem e Etiqueta/Bula) para importar dados do Vincular China.

## Alterações

### 1. Migration — adicionar `submissao_id` na tabela `produto_fluxo_artes`

A tabela não possui coluna `submissao_id`. Adicionar como nullable UUID com FK para `china_produto_submissoes`.

```sql
ALTER TABLE public.produto_fluxo_artes
  ADD COLUMN submissao_id uuid REFERENCES public.china_produto_submissoes(id);
```

### 2. `useFluxoArtesMotor.ts` — atualizar tipo e mutation

- Adicionar `submissao_id` ao tipo `FluxoArte`
- Aceitar `submissao_id` opcional no `useCreateFluxoArte` e incluí-lo no insert

### 3. `FluxoArtesMotor.tsx` — refatorar diálogo de criação

- Adicionar tabs "Importar do Vincular China" / "Preenchimento Manual" (mesmo padrão dos outros módulos)
- No modo vinculado: buscar submissões via `china_submissao_tarefa_vinculos` → `china_produto_submissoes`
- Ao selecionar: auto-preencher `produto_id`, `sku`, `produto_nome`, `linha_marca` e `submissao_id`
- Preview de documentos vinculados à submissão selecionada
- Manter seletor de tipo de checklist em ambos os modos

### 4. Filtro na listagem

- Filtrar fluxos para exibir apenas aqueles cujo `submissao_id` está vinculado (ou sem submissao_id)

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | ADD COLUMN `submissao_id` em `produto_fluxo_artes` |
| `src/hooks/useFluxoArtesMotor.ts` | Tipo + mutation com `submissao_id` |
| `src/pages/FluxoArtesMotor.tsx` | Diálogo com seletor vinculado + filtro listagem |

## Fluxo

```text
[Novo Checklist] → Dialog abre
  → Tab "Importar do Vincular China": cards de submissões vinculadas
  → Selecionar → auto-preenche campos + preview docs
  → Selecionar tipo de checklist
  → [Criar] → fluxo criado com submissao_id
```

