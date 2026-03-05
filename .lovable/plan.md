

## Ajuste: Nome do Produto sem Corte no Cronograma

### Problema
A coluna de produto tem `width: 200px` fixo e o texto usa `truncate`, cortando nomes longos. Além disso, a coluna não é sticky, então ao rolar horizontalmente perde-se a referência.

### Solução

**Arquivo**: `src/components/projetos/ProjetoCronogramaView.tsx`

1. **Aumentar largura da coluna** de `200px` para `260px`
2. **Remover `truncate`** do nome do produto e usar `line-clamp-2` para permitir até 2 linhas
3. **Tornar a coluna sticky** com `position: sticky; left: 0; z-index: 10` para que fique fixa ao rolar horizontalmente
4. **Adicionar sombra** na borda direita da coluna sticky para dar profundidade visual

