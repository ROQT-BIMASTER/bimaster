

# Mostrar campo Produto em todos os tipos de projeto

## Problema
O campo "Produto" no detalhe da tarefa só aparece quando o projeto é do tipo `desenvolvimento_produto` ou tem vínculo China. Projetos genéricos (como "Sazonais | Ruby Rose") não exibem a opção de vincular produto acabado — nem da Fábrica Brasil nem da China.

## Correção

### `src/components/projetos/ProjetoTarefaDetalhe.tsx`

Remover a condição restritiva na linha 581:

```tsx
// De:
{(projetoTipo === 'desenvolvimento_produto' || chinaVinculo) && (

// Para:
{(
```

Isso fará o campo "Produto" aparecer em **todos** os tipos de projeto, permitindo vincular produtos acabados da Fábrica Brasil ou China a qualquer tarefa.

A busca de produtos (`searchProdutos`) já consulta `fabrica_produtos` sem restrição de tipo de projeto, então não precisa de ajuste adicional.

| Arquivo | Alteração |
|---------|-----------|
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Remover condição que oculta o campo Produto |

