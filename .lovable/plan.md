

## Problem

The edge function `meeting-transcribe` was **never redeployed** after the code was updated. The logs prove this conclusively — they show the OLD behavior:
- "Generating signed URL for meeting-recordings/..."
- "Downloading and encoding audio, mimeType: audio/webm"
- "File size: 10.8MB"
- "Memory limit exceeded"

None of these log messages exist in the current code (which accepts `audioBase64` from the client). The frontend chunking code is already correct and ready.

## Plan

Two actions needed:

1. **Redeploy `meeting-transcribe`** — Force deploy the edge function so the new chunk-accepting code goes live. This is the only fix needed.

2. **Reset meeting status** — Run a SQL update to set the stuck meeting back to `draft` so the "Analisar com IA" button works again:
   ```sql
   UPDATE public.meetings SET status = 'draft' 
   WHERE id = '5e2b53cc-23a3-46ae-8664-168175ce3412';
   ```

No code changes are needed — the frontend (`ReuniaoDetalhe.tsx`) and edge function (`meeting-transcribe/index.ts`) code are already correct. The issue is purely a deployment problem.

