

## Problem

The transcription consistently fails at chunk 3 of 14. The logs show the pattern: chunks 1-2 succeed, chunk 3 starts processing, then the Edge Function shuts down. This happens **every single attempt**.

**Root cause: Raw byte-slicing of audio containers produces invalid fragments.**

WebM/MP4 files have a **container header** at the beginning of the file. When the audio-chunker does `blob.slice(start, end)`, only chunk 0 gets the valid header. Chunks 1+ are raw bytes without container metadata — Gemini can sometimes guess the format for chunk 1-2, but by chunk 3 it fails completely, causing the model to hang until the Edge Function times out and shuts down.

Additionally, each chunk is ~800KB raw = ~1.09MB base64. The Gemini Audio API has a practical limit around 15MB, but even small invalid audio fragments cause it to spin indefinitely.

## Solution

### 1. Increase chunk size to ~4MB (fewer, larger chunks with valid headers)

Since we can't properly split audio containers without re-encoding (which requires ffmpeg, not available in browser), the better approach is to **send the entire file as a single chunk if under 15MB**, or use **much larger chunks** (4MB) to reduce the total number of calls. For files over 15MB, we'll need a different strategy.

Actually, the fundamental fix is: **stop splitting raw audio bytes**. Instead:

### Strategy: Send entire audio as one request if under ~10MB base64

For most meeting recordings (under ~7.5MB raw / ~10MB base64), send the whole file in a single Edge Function call. This avoids the invalid-fragment problem entirely.

For larger files, increase chunk size to **4MB** (producing ~5.3MB base64), which keeps us well under Gemini's 15MB audio limit while dramatically reducing the number of chunks (from 14 to ~3).

### Changes

| File | Change |
|---|---|
| `src/lib/utils/audio-chunker.ts` | Increase `CHUNK_SIZE_BYTES` from 800KB to **4MB**. Increase single-chunk threshold to 5MB. |
| `src/pages/ReuniaoDetalhe.tsx` | Keep batch size 1, increase inter-chunk delay to 5s (larger chunks need more processing time) |
| `supabase/functions/meeting-transcribe/index.ts` | Reduce timeout from 50s to 45s for safety margin. Already using Flash which is correct. |
| SQL migration | Reset stuck meetings |

### 2. Save partial transcriptions to DB

Add incremental saves — after each successful chunk, update the `transcription` column with what we have so far. If the process fails mid-way, the user doesn't lose completed work.

| File | Change |
|---|---|
| `src/pages/ReuniaoDetalhe.tsx` | After each successful chunk, save partial transcription to DB |

### 3. Better progress UX

Show step-by-step status like professional tools:

```text
✓ Áudio enviado
⟳ Transcrevendo trecho 2 de 4...
○ Analisando reunião
○ Gerando insights
```

| File | Change |
|---|---|
| `src/pages/ReuniaoDetalhe.tsx` | Update progress_detail messages to show step-by-step status |

### Summary

The core fix is using **4MB chunks instead of 800KB** — this means a ~11MB recording produces only 3 chunks instead of 14, each chunk is a larger valid audio segment, and the total number of Edge Function calls drops dramatically. Combined with partial saves, the process becomes resilient to failures.

