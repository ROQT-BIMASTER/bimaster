

# Seletor de Plano no Dialog "Marcar para Revisão"

## Objetivo

Adicionar ao dialog `MarcarRevisaoDialog` a opção de selecionar um plano de redução existente ou criar um novo, vinculando o item ao `plano_id` na inserção.

## Alterações

### `src/components/financeiro/MarcarRevisaoDialog.tsx`

1. **Query de planos**: Buscar todos os `planos_reducao` ativos para popular o seletor.

2. **Seletor de plano**: Adicionar um campo Select logo após o bloco de informações do item, com:
   - Lista dos planos existentes como opções
   - Uma opção especial "Criar novo plano" no final da lista

3. **Inline de criação**: Ao selecionar "Criar novo plano", exibir campos inline (Nome e Descrição) com botão para salvar. Após criar, selecionar automaticamente o novo plano.

4. **Inserção com `plano_id`**: No `handleSubmit`, incluir o `plano_id` selecionado no insert de `contas_pagar_revisao`.

5. **Validação**: Exigir que um plano esteja selecionado antes de submeter.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/financeiro/MarcarRevisaoDialog.tsx` | Seletor de plano existente + criação inline + vincular `plano_id` no insert |

