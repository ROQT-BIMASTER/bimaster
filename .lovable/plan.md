

## Problem

The logs show chunks 1/3 and 2/3 succeed fine (5.5MB base64 each), but **chunk 3/3 always causes shutdown**. This is because chunk 3 is a tail fragment (3.9MB) without a valid WebM container header — Gemini can't parse it, hangs trying, and the Edge Function times out.

The recording is ~11MB total. Splitting it into 3 chunks creates one invalid fragment that always fails.

## Why Apps Like Notex AI Are Faster

Apps like Notex use dedicated speech-to-text engines (Whisper) that process audio natively in seconds. We're using a multimodal LLM (Gemini) which treats audio as a secondary modality — slower but doesn't require a separate API key.

The fastest fix within our constraints: **send the entire file as one request** and use the fastest model.

## Solution

### 1. Increase single-chunk threshold to 15MB raw (~20MB base64)

Gemini supports up to 20MB inline data. Our file is ~11MB — it should go as **one single request**, eliminating the invalid-fragment problem entirely and cutting from 3 calls to 1.

**File:** `src/lib/utils/audio-chunker.ts`
- Change single-chunk threshold from `5MB` to `15MB`
- This means files up to ~15MB raw (most meetings under 1 hour) go as a single request

### 2. Switch transcription to `google/gemini-2.5-flash-lite`

Flash-lite is the **fastest** Gemini model. For pure audio-to-text (no reasoning needed), it's ideal — 2-5x faster than regular Flash.

**File:** `supabase/functions/meeting-transcribe/index.ts`
- Change model from `gemini-2.5-flash` to `gemini-2.5-flash-lite`

### 3. Simplify the transcription prompt

The current prompt asks for diarization, speaker identification, pause marking — all slowing down processing. Simplify to just "transcribe this audio" for speed. Move diarization to the analysis step which already uses Pro.

**File:** `supabase/functions/meeting-transcribe/index.ts`
- Shorter system prompt focused only on transcription

### 4. Remove unnecessary delays

With single-chunk processing, the 5-second inter-chunk delay and retry backoff are unnecessary for most files.

**File:** `src/pages/ReuniaoDetalhe.tsx`
- Reduce inter-chunk delay to 2s (only matters for very large files)

### 5. Reset stuck meeting

SQL migration to reset stuck meetings.

### Summary

| Change | Impact |
|---|---|
| 15MB single-chunk threshold | 1 request instead of 3 — eliminates invalid fragments |
| `gemini-2.5-flash-lite` model | 2-5x faster transcription |
| Simpler prompt | Less processing overhead |
| Reduced delays | Faster overall flow |

**Expected result:** ~11MB file processes in **one single request** taking 10-20 seconds total instead of 3 sequential calls with failures.

