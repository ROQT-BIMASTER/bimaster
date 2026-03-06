

## Problem

The meeting transcription keeps failing. The Edge Function logs show repeated "shutdown" events — the function times out or crashes before the AI model returns a transcription. Even with batch size 2, each chunk sends ~1.09MB of base64 data to the AI gateway, and the Gemini response takes 15-30s. Two concurrent calls overwhelm the Edge Function's resources.

**Current stats:** Meeting "Planejamento Lideranças" is stuck at `draft`, progress 5%, 0/14 chunks completed.

## Root Cause

- **Batch size 2 is still too much** — two 1MB payloads processed simultaneously cause memory/timeout shutdowns
- **800KB chunk size** produces 14 chunks for this recording — too many calls, each prone to failure
- **3-second retry backoff** is too short — the function needs more breathing room

## Solution

### 1. Sequential processing (batch size 1)
Process **one chunk at a time**. This eliminates concurrent memory pressure entirely.

**File:** `src/pages/ReuniaoDetalhe.tsx` (line 160)
- Change `BATCH_SIZE` from 2 to **1**

### 2. Increase inter-chunk delay to 3 seconds  
Give the Edge Function time to fully shut down and free resources between calls.

**File:** `src/pages/ReuniaoDetalhe.tsx` (line 216)
- Change delay from 2000ms to **3000ms**

### 3. Increase retry backoff  
Change retry delay from `3000 * attempt` to `5000 * attempt` (5s, 10s, 15s) to avoid hammering a struggling function.

**File:** `src/pages/ReuniaoDetalhe.tsx` (line 174)
- Change `3000 * attempt` to `5000 * attempt`

### 4. Reset the stuck meeting  
SQL migration to reset the meeting back to `draft` with clean progress.

### Summary

| Change | Details |
|---|---|
| Batch size 1→1 | Sequential, no concurrency |
| Inter-chunk delay 2s→3s | More breathing room |
| Retry backoff 3s→5s multiplier | Less aggressive retries |
| Reset stuck meeting | Clean slate to retry |

The tradeoff is speed — 14 chunks × ~20s each ≈ ~5 minutes total instead of ~2 minutes. But it will actually **complete** instead of crashing.

