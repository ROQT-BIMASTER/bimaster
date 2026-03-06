

## Diagnóstico: IA transcrevendo apenas 3 minutos de 11 minutos

### Causa Raiz

O problema está no modelo usado para transcrição: **`google/gemini-2.5-flash-lite`** (linha 80 do `meeting-transcribe/index.ts`).

Este é o modelo mais leve e barato da família Gemini. Ele tem limitações significativas no processamento de áudio longo — tipicamente processa apenas os primeiros ~3 minutos de áudio inline via base64, ignorando o restante silenciosamente (sem erro).

Além disso, o **timeout de 50 segundos** (linha 68) pode estar cortando a transcrição antes do modelo terminar de processar todo o áudio.

### Solução

Duas mudanças na Edge Function `meeting-transcribe`:

1. **Trocar o modelo de transcrição** de `google/gemini-2.5-flash-lite` para **`google/gemini-2.5-flash`** — modelo intermediário que suporta áudio longo com boa velocidade e custo razoável, mantendo capacidade multimodal completa.

2. **Aumentar o timeout** de 50s para **120s** para dar tempo ao modelo de processar áudios de 10-15 minutos por chunk.

3. **Reforçar o prompt** para instruir explicitamente a transcrever do início ao fim, incluindo timestamps periódicos para garantir cobertura completa.

### Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/meeting-transcribe/index.ts` | Modelo → `gemini-2.5-flash`, timeout → 120s, prompt reforçado |

### Impacto

- Nenhuma alteração no frontend ou no fluxo de chunking
- Nenhuma alteração na análise (`meeting-analyze` já usa `gemini-2.5-pro`)
- Custo por transcrição ligeiramente maior (flash vs flash-lite), mas com resultado completo

