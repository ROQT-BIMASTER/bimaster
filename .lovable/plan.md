

## Problem

The `meeting-transcribe` Edge Function crashes with **"Memory limit exceeded"** every time it tries to process the 10.8MB audio file. The sequence:

1. Downloads 10.8MB webm file into memory (~11MB)
2. Base64 encodes it (~14.5MB) 
3. Builds JSON payload with the base64 string (~15MB+)
4. Total memory: ~40MB+ which exceeds Edge Function limits when combined with Deno runtime overhead

The AI Gateway requires non-image media as `data:` URLs (base64), so we cannot send a plain URL. This is a fundamental memory constraint of Edge Functions.

## Solution: Split audio into chunks client-side

Since the Edge Function cannot hold the full file in memory, we need to **split the transcription work into smaller pieces**. The approach:

### Strategy: Client-side chunked transcription

1. **Client downloads the audio** (browser has no memory limits like Edge Functions)
2. **Client splits the audio into ~2-minute chunks** using the Web Audio API or by sending byte ranges
3. **Client sends each chunk individually** to `meeting-transcribe` as base64 (each chunk ~2-3MB = ~4MB base64, well within limits)
4. **Edge Function transcribes each chunk** and returns partial transcription
5. **Client concatenates all partial transcriptions** and saves the full result
6. **Then triggers `meeting-analyze`** on the complete text

### Implementation Details

**New file: `src/lib/utils/audio-chunker.ts`**
- Function to download audio blob from signed URL
- Split audio blob into chunks of ~2 minutes / ~3MB each
- Convert each chunk to base64 string
- Return array of `{ base64: string, mimeType: string, chunkIndex: number, totalChunks: number }`

**Modified: `supabase/functions/meeting-transcribe/index.ts`**
- Accept `audioBase64` and `mimeType` directly in the request body (instead of downloading)
- Accept `chunkIndex` and `totalChunks` for context
- Remove all download/encode logic from the Edge Function
- Just receive base64 from client → send to Gemini → return transcription text
- If `chunkIndex === 0`, include full system prompt; otherwise add context about continuation

**Modified: `src/pages/ReuniaoDetalhe.tsx`**
- Update `handleAnalyze` to:
  1. Get a signed URL for the audio
  2. Download the audio blob in the browser
  3. Split into chunks (~2-3MB each)
  4. Loop through chunks, calling `meeting-transcribe` for each with progress toasts ("Transcrevendo parte 1/4...")
  5. Concatenate all transcription results
  6. Save full transcription to DB
  7. Proceed to step 2 (analyze)

### Why this works
- Each Edge Function call only handles ~4MB of base64 data (well under memory limits)
- Browser has ample memory for a 10.8MB file
- No timeout issues since each chunk is small and fast
- Transcription quality maintained by providing context about chunk order

### Reset meeting status
- SQL migration to reset the stuck meeting back to `draft` status so the button works again

