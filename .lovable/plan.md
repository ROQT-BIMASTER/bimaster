

## Diagnóstico: Áudio de 11 min ainda transcrito parcialmente

### Causa Raiz

O chunker atual divide por **tamanho de bytes** (15MB), não por **duração**. Um áudio de 11 minutos em webm/opus ocupa ~2-5MB — bem abaixo de 15MB — então é enviado como **chunk único**. O modelo `gemini-2.5-flash` recebendo ~11 minutos de áudio inline via base64 ainda pode truncar a transcrição, especialmente se o payload base64 resultante for muito grande para processar completamente dentro do tempo de geração do modelo.

### Solução: Dividir áudio em chunks temporais de ~4 minutos

Em vez de dividir por bytes, dividir o áudio em segmentos de **~4 minutos** usando a Web Audio API (AudioContext). Cada chunk terá no máximo ~4 minutos de duração, garantindo que o modelo transcreva cada trecho completamente.

### Alterações

| Arquivo | Alteração |
|---|---|
| `src/lib/utils/audio-chunker.ts` | Reescrever para usar AudioContext: decodificar o áudio, dividir o buffer em segmentos de ~4 minutos, re-encodar cada segmento como WAV base64. Isso garante chunks baseados em tempo, não em bytes. |
| `supabase/functions/meeting-transcribe/index.ts` | Ajustar o prompt para informar ao modelo a posição temporal do chunk (ex: "Este é o trecho dos minutos 4:00 aos 8:00") para timestamps mais precisos. Aumentar `max_tokens` se necessário. |

### Detalhes Técnicos

1. **AudioContext decode** — `decodeAudioData()` carrega o áudio completo na memória como PCM
2. **Slice por samples** — Cada chunk = `sampleRate × 240` samples (4 minutos)
3. **Re-encode como WAV** — WAV é universalmente aceito e fácil de gerar em JS (header de 44 bytes + PCM data)
4. **Trade-off**: WAV é maior que webm/opus (~10x), mas cada chunk de 4 min em mono 16kHz ≈ 7.5MB raw → ~10MB base64, dentro dos limites
5. **Prompt contextual**: Cada chunk inclui no payload o offset temporal para que o modelo use timestamps corretos

### Impacto

- Áudios de até ~1 hora serão divididos em ~15 chunks de 4 minutos cada
- Cada chunk é pequeno o suficiente para o modelo transcrever completamente
- O fluxo no frontend (retry, progresso, merge) já está implementado e funciona com múltiplos chunks

