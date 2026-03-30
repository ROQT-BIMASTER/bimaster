

# Filtrar Checklist Composição por Submissões Vinculadas

## Problema

A tela `ChecklistComposicao` exibe TODAS as submissões da tabela `china_produto_submissoes`. O correto é mostrar apenas submissões que passaram pela etapa "Vincular China" (possuem registro em `china_submissao_tarefa_vinculos`).

## Solução

Alterar o hook `useSubmissoes()` dentro de `ChecklistComposicao.tsx` para:

1. Buscar os `submissao_id` distintos de `china_submissao_tarefa_vinculos`
2. Filtrar `china_produto_submissoes` usando `.in("id", submissaoIdsVinculados)`
3. Mostrar mensagem vazia contextual orientando o usuário a usar a tela "Vincular China" quando não houver resultados
4. Atualizar KPIs para refletir apenas os itens vinculados

## Detalhes Técnicos

A query será em dois passos:
```
1. SELECT DISTINCT submissao_id FROM china_submissao_tarefa_vinculos
2. SELECT ... FROM china_produto_submissoes WHERE id IN (ids do passo 1)
```

A mensagem de estado vazio mudará de "Nenhuma submissão encontrada" para incluir orientação sobre a tela Vincular China.

## Arquivo Afetado

| Arquivo | Ação |
|---------|------|
| `src/pages/ChecklistComposicao.tsx` | Alterar `useSubmissoes` para filtrar por vínculos; atualizar empty state |

