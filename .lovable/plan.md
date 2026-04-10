

# Correção: Geração de Arte e Preview Live no Design Studio

## Problemas Identificados

### 1. Stitch: Designs salvos sem preview_url e sem html_code
Todos os designs na tabela `stitch_designs` têm `preview_url: NULL` e `html_code: NULL`. A função `extractScreenData` não está extraindo corretamente os dados da resposta do Stitch MCP. O resultado é que a galeria mostra ícones de imagem quebrada e o Preview Live não tem conteúdo para exibir.

### 2. Bug crítico: `genParams` usado antes de ser declarado
Na `stitch-proxy/index.ts`, linha 293 referencia `genParams.projectId` mas `genParams` só é definido na linha 311. Isso causa um `ReferenceError` quando o fallback de HTML é ativado, crashando a função.

### 3. Preview Live: sem conteúdo para renderizar
Como `html_code` e `preview_url` são `null`, o componente `DesignPreview` não tem nada para exibir — mostra "Nenhum conteúdo disponível".

## Correções

### A. Corrigir `stitch-proxy/index.ts`
1. **Mover `genParams`** para antes do bloco de resolução de HTML (linha 293 usa, mas é declarado na 311)
2. **Melhorar `extractScreenData`** — adicionar logging da resposta bruta do Stitch para diagnosticar o formato real retornado. Tentar múltiplos caminhos de extração (o Stitch pode retornar dados em formato diferente do esperado)
3. **Salvar a resposta bruta** do MCP como fallback no campo `html_code` caso a extração falhe, para debug

### B. Corrigir `DesignPreview.tsx`
1. Quando não há HTML nem previewUrl, mostrar mensagem mais útil com botão para re-gerar
2. Melhorar o fallback para exibir o que estiver disponível

### C. Adicionar logging diagnóstico
1. Logar a resposta completa do Stitch MCP para identificar o formato exato dos dados retornados
2. Isso permitirá ajustar o `extractScreenData` para o formato real

## Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/stitch-proxy/index.ts` | Fix genParams, melhorar extractScreenData, adicionar logging |
| `src/components/marketing/studio/DesignPreview.tsx` | Melhorar mensagem quando sem conteúdo |

