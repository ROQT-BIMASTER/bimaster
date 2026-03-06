

## Problem

The transcription is **not stuck due to Google payments** — you don't need to pay anything extra. Lovable AI handles billing automatically.

The real issue: **Edge Function shutdowns** during chunk processing. The logs show chunks 1-3 succeed but chunks 4-6 trigger shutdowns. Two causes:

1. **`gemini-2.5-pro` is too slow for audio** — Pro takes 20-40s per chunk vs Flash's 5-10s. Combined with the 50s timeout, many chunks timeout.
2. **Batch of 3 parallel calls** overwhelms the Edge Function memory/concurrency limits — sending 3 × 1MB base64 payloads simultaneously causes crashes.

## Solution

### 1. Switch to `google/gemini-2.5-flash` for transcription only

Flash is actually **better suited for audio transcription** — it's fast and accurate for speech-to-text. Keep Pro only for `meeting-analyze` where complex reasoning matters.

**File:** `supabase/functions/meeting-transcribe/index.ts`
- Change model back to `google/gemini-2.5-flash` (line 100)

### 2. Reduce parallel batch size from 3 to 2

Less concurrent calls = less memory pressure = fewer shutdowns.

**File:** `src/pages/ReuniaoDetalhe.tsx`
- Change `BATCH_SIZE` from 3 to 2 (line 160)

### 3. Add 2s delay between batches

More breathing room between batches to prevent rate limiting and function crashes.

**File:** `src/pages/ReuniaoDetalhe.tsx`  
- Increase inter-batch delay from 1000ms to 2000ms (line 216)

### 4. Reset stuck meetings

SQL migration to reset any meetings stuck in transcribing/analyzing state.

### Summary

| Change | File |
|---|---|
| Use `gemini-2.5-flash` for transcription (faster, reliable for audio) | `meeting-transcribe/index.ts` |
| Keep `gemini-2.5-pro` for analysis (complex reasoning) | No change needed |
| Reduce batch size to 2 | `ReuniaoDetalhe.tsx` |
| Increase inter-batch delay to 2s | `ReuniaoDetalhe.tsx` |
| Reset stuck meetings | SQL migration |

**Important:** You do NOT need to pay anything to Google. The Lovable AI gateway handles all billing. The issue is purely technical — the functions are crashing from overload.

