

## Solução: ElevenLabs Scribe v2 para Transcrição Dedicada

### Problema Atual

O Gemini Flash está recebendo o áudio inteiro como base64 inline numa chamada de chat completions. Isso força o modelo a "ouvir" o áudio em tempo real de processamento, causando truncamento e timeouts para áudios acima de ~5 minutos. O Gemini não é um modelo de STT dedicado — ele é um LLM multimodal que tenta transcrever como tarefa secundária.

### Solução

Usar o **ElevenLabs Scribe v2** (API de Speech-to-Text dedicada) que já está disponível no projeto (`ELEVENLABS_API_KEY` configurada). O Scribe v2 transcreve 1 hora de áudio em poucos segundos, suporta diarização de falantes e retorna timestamps word-level.

O fluxo muda de:

```text
ANTES:  Audio → base64 → Gemini (LLM tentando transcrever) → trunca

DEPOIS: Audio → ElevenLabs Scribe v2 (STT dedicado, ~5s) → texto puro
        Texto → Gemini (análise estratégica) → insights, ata, tarefas
```

### Alterações

| Arquivo | Alteração |
|---|---|
| `supabase/functions/meeting-transcribe/index.ts` | Substituir a chamada ao Gemini com áudio base64 por uma chamada multipart `POST https://api.elevenlabs.io/v1/speech-to-text` com `model_id=scribe_v2`. O áudio é enviado como file (blob), não base64. Scribe v2 retorna o texto transcrito com diarização e timestamps. |

### Detalhes Técnicos

1. **Edge Function baixa o áudio** do Storage via signed URL (já implementado)
2. **Envia como FormData** para `https://api.elevenlabs.io/v1/speech-to-text`:
   - `file`: blob do áudio (webm/opus, ~5MB para 11min)
   - `model_id`: `scribe_v2`
   - `language_code`: `por` (português)
   - `diarize`: `true` (identificar falantes)
   - `timestamps_granularity`: `word` (timestamps por palavra)
3. **Resposta do Scribe**: JSON com `text` (transcrição completa), `words` (array com timestamps), `utterances` (por falante)
4. **Formata a transcrição** com falantes e timestamps [MM:SS] a partir dos utterances
5. **Retorna o texto** — o Gemini 2.5 Pro na etapa de análise (já existente) recebe apenas texto puro

### Vantagens

- Transcrição de 11 minutos em ~3-5 segundos (vs timeout atual)
- Diarização nativa (identifica quem falou)
- Timestamps precisos por palavra
- Sem limites de duração práticos (suporta horas)
- API key já configurada no projeto
- Nenhuma alteração no frontend necessária

