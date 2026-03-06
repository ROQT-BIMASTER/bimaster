

## Problema Identificado

Os logs mostram claramente: **"Memory limit exceeded"**. A função `meeting-analyze` baixa o arquivo inteiro para memória, converte para base64 (que aumenta ~33% o tamanho), e envia tudo para o Gemini. Uma gravação de 11 minutos excede o limite de memória da Edge Function (~150MB).

**Sua gravação está segura** — ela foi salva no storage com sucesso. O problema é apenas na análise.

## Solução: Transcrição em 2 Etapas com Chunking

### 1. Nova Edge Function `meeting-transcribe` (etapa separada)
- Em vez de baixar o arquivo inteiro para memória, **envia a URL pública diretamente** para o Gemini (que aceita URLs de mídia)
- Se a URL não for pública, gera uma signed URL temporária e passa como URL para o modelo
- Gemini aceita `file_url` no content — evita carregar base64 na memória
- Salva a transcrição no campo `transcription` do meeting
- Retorna imediatamente após a transcrição

### 2. Refatorar `meeting-analyze` 
- **Remove toda a lógica de download/base64** de áudio
- Passa a trabalhar APENAS com texto (transcrição já pronta)
- Muito mais leve em memória — apenas texto puro
- Se não houver transcrição, chama `meeting-transcribe` primeiro

### 3. Frontend: Fluxo em 2 passos no `handleAnalyze`
- **Passo 1**: Chama `meeting-transcribe` → toast "Transcrevendo áudio..."
- **Passo 2**: Chama `meeting-analyze` com a transcrição retornada → toast "Analisando..."
- Polling do status do meeting para feedback em tempo real
- Se a transcrição já existir, pula direto para análise

### 4. Fallback: URL direta para Gemini
- O Gemini 2.5 Flash suporta receber mídia via URL diretamente no campo `image_url`
- Em vez de `data:audio/webm;base64,<ENORME>`, usar a signed URL do storage
- Isso elimina completamente o problema de memória

## Arquivos Impactados
- `supabase/functions/meeting-analyze/index.ts` — remover download/base64, usar só texto
- `supabase/functions/meeting-transcribe/index.ts` — nova função leve que envia URL para Gemini
- `src/pages/ReuniaoDetalhe.tsx` — fluxo em 2 passos
- `supabase/config.toml` — registrar nova função

## Resultado
- A gravação de 11 minutos será analisada sem erro de memória
- Nenhum dado será perdido — a gravação continua no storage

