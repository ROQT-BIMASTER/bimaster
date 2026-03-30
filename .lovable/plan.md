

# Filtrar Documentos do Processo por Vinculos da Tela Vincular China

## Problema

Atualmente, a aba "Documento do Processo" no dialog de Extração com IA busca TODOS os documentos da submissão (`china_produto_documentos` WHERE `submissao_id`). O correto é mostrar apenas os documentos que foram despachados/vinculados ao módulo Composição via a tela "Vincular China", usando a tabela `china_documento_tarefa_vinculos`.

## Solução

Alterar `loadProcessoDocs` no `ExtrairIngredientesIADialog.tsx` para:

1. Buscar os vínculos em `china_documento_tarefa_vinculos` filtrando pelos documentos da submissão atual
2. Usar os `documento_id` encontrados para filtrar `china_produto_documentos`
3. Mostrar apenas documentos que possuem vínculo (foram despachados para este módulo)

A lógica será:
- Buscar vínculos: `china_documento_tarefa_vinculos` WHERE `documento_id` IN (documentos da submissão)
- Filtrar documentos que aparecem nos vínculos
- Exibir mensagem contextual quando não há documentos vinculados, orientando o usuário a usar a tela Vincular China

## Arquivo Afetado

| Arquivo | Ação |
|---------|------|
| `src/components/composicao/ExtrairIngredientesIADialog.tsx` | Alterar `loadProcessoDocs` para filtrar por `china_documento_tarefa_vinculos`; mensagem vazia contextual |

