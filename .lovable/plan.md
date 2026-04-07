

# Exibir Usuário que Cadastrou / Alterou Produto

## Situação Atual

As colunas `created_by` e `updated_by` já existem na tabela `fabrica_produtos` e estão preenchidas. Porém, não são exibidas na tela.

## Alterações

### `src/pages/FabricaProdutosAcabados.tsx`

1. **Query**: Expandir o `select` para incluir join com profiles:
   ```
   criador:profiles!fabrica_produtos_created_by_fkey(nome),
   atualizador:profiles!fabrica_produtos_updated_by_fkey(nome)
   ```

2. **Tabela — nova coluna "Responsável"** (entre "Status" e "Ações"):
   - Mostrar nome do último usuário que alterou (`updated_by`), ou o criador (`created_by`) se nunca foi editado
   - Formato: nome + label pequeno "Criou" ou "Editou" + data relativa (ex: "há 2h")

3. **Card view**: Adicionar linha com ícone de usuário mostrando o responsável

## Impacto
- Apenas visual — sem migration, sem mudança de RLS
- Coluna compacta para não sobrecarregar a tabela

