

# Correção do Preview Live + Exportação para Figma

## Problema 1: Preview Live não carrega

**Diagnóstico**: O Stitch retorna `htmlCode` como uma URL de download temporária (ex: `https://stitch.googleapis.com/.../download`). O proxy tenta fazer fetch dessa URL server-side, mas pode falhar silenciosamente. Quando falha, o valor fica como URL e o `DesignPreview` no frontend tenta fazer fetch dessa URL, que pode estar expirada ou bloqueada por CORS. Resultado: iframe vazio.

**Correção**:
1. **No `stitch-proxy/index.ts`**: Melhorar a resolução de HTML — adicionar retry, logging e fallback. Se `htmlCode` é URL e o fetch falha, logar o erro explicitamente e tentar usar o `get_screen` para buscar o HTML diretamente.
2. **No `DesignPreview.tsx`**: Adicionar melhor tratamento quando o HTML é uma URL que falha — mostrar mensagem de erro clara e botão para abrir a URL diretamente. Também adicionar o `previewUrl` (screenshot) como fallback quando HTML não está disponível.
3. **Adicionar logging** no stitch-proxy para diagnosticar falhas de fetch do HTML.

## Problema 2: Exportar para Figma

**Abordagem**: O Figma REST API não permite criar designs diretamente (é read-only para design files). A melhor abordagem é:

1. **Exportar HTML como SVG** — converter o HTML renderizado em SVG via `foreignObject`, que o Figma importa nativamente.
2. **Copiar código CSS/HTML** formatado para colar no plugin **"HTML to Figma"** (plugin popular e gratuito do Figma).
3. **Download como .fig** não é viável (formato proprietário).

**Implementação**:
1. **Novo botão "Exportar p/ Figma"** na galeria e no preview, com duas opções:
   - **Download SVG** (importável no Figma via File > Place Image ou drag-and-drop)
   - **Copiar HTML** (para usar com o plugin "HTML to Figma" do Figma Community)
2. **Guia rápido** inline explicando como importar no Figma

## Arquivos a alterar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/stitch-proxy/index.ts` | Melhorar fetch de HTML + logging |
| `src/components/marketing/studio/DesignPreview.tsx` | Fix fallback quando HTML falha + adicionar botão Figma |
| `src/components/marketing/studio/ExportOptions.tsx` | Adicionar opção "Exportar p/ Figma" (SVG + copiar HTML) |
| `src/components/marketing/StitchDesignStudio.tsx` | Ajuste menor no preview fallback |

## Detalhes Técnicos

**Fix do Preview**:
- O proxy fará até 2 tentativas de fetch do `htmlCode` URL com timeout de 5s
- Se todas falharem, salva a URL no campo `html_code` e o frontend usará o `previewUrl` (screenshot) como fallback
- O `DesignPreview` mostrará a screenshot quando HTML não está disponível, com mensagem explicando

**Exportação Figma**:
- SVG gerado via `foreignObject` wrapping o HTML do design
- Botão "Copiar para Figma" copia o HTML limpo para clipboard + mostra toast com instruções do plugin
- Sem necessidade de API key do Figma — tudo client-side

