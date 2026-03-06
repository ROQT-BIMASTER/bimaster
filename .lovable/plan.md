

## Diagnóstico: Chunks WAV muito grandes para a Edge Function

### Causa Raiz

O áudio original provavelmente tem sample rate de **48kHz**. Ao converter para WAV mono 16-bit, cada chunk de 4 minutos gera:
- **48000 × 240 × 2 = ~23MB** raw → **~30MB base64**

Esse payload é grande demais para o body da Edge Function (limite de ~6-20MB). A requisição falha silenciosamente ou o timeout é atingido tentando enviar/parsear esse JSON enorme.

### Solução: Não converter para WAV — enviar o áudio original em chunks

Em vez de decodificar e re-encodar como WAV (inflando 10x o tamanho), a abordagem correta é:

1. **Enviar o arquivo original comprimido diretamente** — um áudio webm/opus de 11 min ocupa ~2-5MB total
2. **Fazer o chunking no servidor** (Edge Function) baixando o áudio do Storage, ou
3. **Alternativa mais simples**: enviar o áudio original inteiro (sem chunking client-side) já que ~5MB em webm cabe perfeitamente em uma única chamada

### Plano de Implementação

| Arquivo | Alteração |
|---|---|
| `src/pages/ReuniaoDetalhe.tsx` | Simplificar: em vez de chunking client-side, gerar uma signed URL do áudio e enviá-la à Edge Function. Sem download/decode/WAV no browser. |
| `supabase/functions/meeting-transcribe/index.ts` | Aceitar `audioUrl` como alternativa a `audioBase64`. A Edge Function baixa o áudio diretamente do Storage (rápido, mesma rede), converte para base64 e envia ao Gemini. Dividir em múltiplas chamadas ao modelo se necessário (por duração estimada). |
| `src/lib/utils/audio-chunker.ts` | Manter como fallback mas não será usado no fluxo principal. |

### Fluxo Novo

```text
Frontend                    Edge Function              AI Gateway
   │                             │                         │
   │── signed URL + meetingId ──>│                         │
   │                             │── fetch audio (~5MB) ──>│
   │                             │<── audio blob ──────────│
   │                             │── base64 + prompt ─────>│ Gemini 2.5 Flash
   │                             │<── transcription ───────│
   │<── transcription ──────────│                         │
```

### Detalhes

- A Edge Function baixa o áudio do Storage usando a signed URL (rede interna, muito rápido)
- Converte para base64 no servidor (Deno tem memória suficiente para ~50MB)
- Envia o áudio comprimido (webm/opus) diretamente ao Gemini — muito menor que WAV
- Se o áudio for > 20MB base64, divide em 2 chamadas temporais no servidor
- Remove toda a complexidade de chunking no browser

### Impacto

- Elimina o gargalo de memória/payload do browser
- Áudio webm/opus de 11 min (~5MB) cabe numa única chamada
- Processamento mais rápido (sem decode/encode WAV no browser)
- Frontend fica mais simples e responsivo

