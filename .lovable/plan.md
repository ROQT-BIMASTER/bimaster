

## Problem

The `meeting-transcribe` Edge Function uses `google/gemini-2.5-flash` for audio transcription. The logs show it consistently crashes/shuts down around chunk 3, likely because Flash is not powerful enough for reliable audio-to-text transcription of these chunks. The `meeting-analyze` function also uses Flash for the analysis phase.

## Solution

Upgrade both functions to use `google/gemini-2.5-pro` — the most powerful model available for multimodal (audio+text) tasks. Pro has significantly better audio understanding and handles larger/complex inputs more reliably.

| File | Change |
|---|---|
| `supabase/functions/meeting-transcribe/index.ts` | Change model from `gemini-2.5-flash` to `google/gemini-2.5-pro` (line 100) |
| `supabase/functions/meeting-analyze/index.ts` | Change model from `gemini-2.5-flash` to `google/gemini-2.5-pro` (line 91) |
| SQL migration | Reset stuck meeting back to `draft` |

Both functions will be redeployed after the model change.

