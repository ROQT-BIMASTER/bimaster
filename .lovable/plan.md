

# Remover Exposição de Lojas no Formulário Público

## Problema

O `MaterialRequestCard` usa `useFilteredStores` para carregar lojas internas no seletor. Quando o formulário é compartilhado externamente (via link público/token), pessoas não autorizadas conseguem ver o cadastro completo de clientes/lojas da empresa.

## Solução

Substituir o seletor de lojas (Popover com lista) por um campo de texto livre onde o usuário externo digita manualmente o nome/endereço da loja. Para usuários autenticados (formulários internos), manter o seletor existente.

A lógica: se o formulário está sendo acessado via token (público), usa input de texto. Se o usuário está autenticado, usa o seletor com `useFilteredStores`.

## Alterações

### `src/components/forms/MaterialRequestCard.tsx`

- Adicionar prop `isPublic` (boolean) — derivada da presença de `tokenId` no renderer
- **Se `isPublic = true`:** renderizar input de texto livre para "Nome da loja / Local de destino" em vez do Popover com lista de lojas. Remover chamada a `useFilteredStores` nesse caso. O `loja_nome` será o texto digitado e `loja_id` será null.
- **Se `isPublic = false`:** manter comportamento atual (seletor com busca)
- Ajustar `handleConfirm` para aceitar `loja_id` como null quando público, usando apenas `loja_nome`

### `src/components/forms/DynamicFormRenderer.tsx`

- Passar `isPublic={!!tokenId}` como prop para cada `MaterialRequestCard`

| Arquivo | Ação |
|---------|------|
| `src/components/forms/MaterialRequestCard.tsx` | Modo público com input texto |
| `src/components/forms/DynamicFormRenderer.tsx` | Passar flag `isPublic` |

