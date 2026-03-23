

# Fix: Erro ao Auditar Documento

## Causa Raiz

Após análise do código da Edge Function `expense-ai-assistant`, identifiquei **dois problemas prováveis**:

### 1. PDF não suportado pelo gateway de IA
Na linha 618-622, quando o documento é PDF, o código envia `type: "file"` com `file_data` — esse formato **não é suportado** pela API do gateway Lovable (compatível com OpenAI). Apenas `image_url` e `text` são formatos válidos. Isso causa erro silencioso na chamada de IA.

### 2. URL do anexo pode não ser parseada corretamente
Se o `attachment_url` vier como URL assinada com token (ex: `?token=...`), a lógica de parsing pode falhar ao extrair bucket/path, gerando erro "Não foi possível baixar o documento".

### 3. CORS hardcoded
A função usa `ALLOWED_ORIGIN` hardcoded ao invés do módulo `_shared/cors.ts`, podendo bloquear requests do preview.

## Solução

### Arquivo: `supabase/functions/expense-ai-assistant/index.ts`

1. **Substituir CORS hardcoded** pelo módulo `_shared/cors.ts` compartilhado (já tem os dois domínios)

2. **Corrigir tratamento de PDF**: Converter PDF para imagens antes de enviar, OU enviar como `image_url` com base64 (Gemini aceita PDF via `image_url` com mime type `application/pdf`)
   ```ts
   // Ao invés de type: "file", usar:
   contentParts.push({
     type: "image_url",
     image_url: { url: `data:${mimeType};base64,${fileBase64}` },
   });
   ```
   Remover o bloco condicional PDF vs imagem — usar sempre `image_url` com o mimeType correto.

3. **Melhorar parsing de URL**: Adicionar suporte para URLs assinadas com query params e para o formato `/object/authenticated/`

4. **Adicionar logs detalhados** nos pontos de falha para diagnóstico futuro

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/expense-ai-assistant/index.ts` | Corrigir CORS, PDF handling, URL parsing, logs |

