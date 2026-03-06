

## Problem

The current system fails on the 11-minute recording and will completely break on 2-hour recordings (~130MB). Two core issues:

1. **Edge Function crashes on chunk 3+** — the `meeting-transcribe` function shuts down mid-processing. The 50s timeout + Gemini processing time for 1.5MB audio chunks causes timeouts/crashes.
2. **No scalability for 2-hour files** — a 2-hour recording at ~130MB would produce ~87 chunks, each requiring a sequential Edge Function call. This is slow, fragile, and will hit rate limits.

## Solution: Smaller chunks + parallel batching + resilient retry

### 1. Reduce chunk size to ~800KB

Smaller chunks = faster Gemini processing = no timeouts. An 800KB chunk (~30-45 seconds of webm audio) processes in ~5-10 seconds by Gemini, well within the 50s timeout.

- 11-min file (~10.8MB) → ~14 chunks
- 2-hour file (~130MB) → ~163 chunks

**File:** `src/lib/utils/audio-chunker.ts`
- Change `CHUNK_SIZE_BYTES` from 1.5MB to 800KB

### 2. Process chunks in parallel batches of 3

Instead of sending chunks one at a time (sequential), send 3 at a time in parallel. This is 3x faster and stays under rate limits.

- 163 chunks / 3 parallel = ~55 batches
- At ~10s per batch = ~9 minutes total for a 2-hour recording (acceptable)

**File:** `src/pages/ReuniaoDetalhe.tsx`
- Replace sequential `for` loop with batched `Promise.all` (batch size = 3)
- Add progress percentage: "Transcrevendo... 45% (chunk 7/14)"
- Add a 1-second delay between batches to avoid rate limiting
- Increase retry attempts to 3 with longer backoff (3s, 6s, 12s)
- If a chunk fails all retries, skip it and note "[trecho inaudível]" instead of aborting entire process

### 3. Handle long transcriptions in meeting-analyze

A 2-hour transcription could be 50,000+ characters. The `meeting-analyze` function sends the entire transcription to Gemini in one call. For very long transcriptions, this could also timeout.

**File:** `supabase/functions/meeting-analyze/index.ts`
- If transcription exceeds 30,000 characters, truncate with a note to the AI that it's a partial view
- Add AbortController timeout (50s) matching meeting-transcribe

### 4. Reset stuck meeting

SQL migration to reset the meeting status back to `draft`.

### Summary of changes

| File | Change |
|---|---|
| `src/lib/utils/audio-chunker.ts` | Reduce chunk size to 800KB |
| `src/pages/ReuniaoDetalhe.tsx` | Parallel batches of 3, progress %, graceful skip on failure |
| `supabase/functions/meeting-analyze/index.ts` | Add timeout + handle very long transcriptions |
| SQL migration | Reset stuck meeting to draft |

