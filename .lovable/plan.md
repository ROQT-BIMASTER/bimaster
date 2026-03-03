

# Corrigir Submissão Automática do Unitário Vinculado ao Kit

## Problema
Quando o Kit/Display é enviado para aprovação, o produto unitário vinculado **não está sendo submetido junto**. Isso acontece porque o código atual em `useFichaRevisao.ts` (linhas 220-229) pula o filho se:
- Não existe `fabrica_produto_custos_config` para o filho
- O filho não possui insumos cadastrados em `fabrica_produto_custos`
- O status do filho já é `em_revisao`

Na prática, o produto unitário pode não ter config ou insumos próprios configurados, fazendo o `continue` ser executado.

## Solução

### Alteração em `src/hooks/useFichaRevisao.ts`

Na função `submeterParaAprovacao`, relaxar as condições para os filhos:

1. **Se o filho não tem config**: criar automaticamente um `fabrica_produto_custos_config` com valores padrão antes de submeter.
2. **Se o filho não tem insumos**: submeter mesmo assim com array vazio de insumos (o snapshot ficará vazio, mas a revisão será criada e aparecerá na listagem da Diretoria).
3. **Se o filho já está `em_revisao`**: pular (manter essa condição, pois já foi submetido).
4. **Se o filho já está com status `aprovada`**: re-submeter com dados atuais para que acompanhe o Kit.

Mudanças específicas:
- Remover o `if (!filhoInsumos || filhoInsumos.length === 0) continue;` (linha 229) -- submeter mesmo sem insumos
- Quando `filhoConfig` não existir, criar um config padrão via insert antes de prosseguir
- Tratar `filhoInsumos` como `[]` quando null

### Arquivo a alterar
- **`src/hooks/useFichaRevisao.ts`**: Ajustar bloco de submissão de filhos (linhas 208-243)

