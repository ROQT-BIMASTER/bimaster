

## Problem Analysis

The logs show the function works but generates only the bare minimum (8 insights, 5 tasks, 3 risks). Two root causes:

1. **Single massive tool call** — The schema demands summary + ata + participants + mindmap (3-4 levels deep) + insights + tasks + risks + highlights ALL in one response. Gemini rushes through to fit everything, producing shallow results.

2. **Edge Function wall-clock limit** — The function took ~68 seconds. Supabase Edge Functions have soft limits that can cause premature termination. For 1-hour audio (~400K chars), this will be worse.

## Solution: Split Analysis into Two Phases

Split the single Gemini call into **two sequential calls**, each focused on a subset of the output:

### Phase 1: Content Analysis (summary, ata, participants, mindmap)
- Focused prompt for narrative/structural content
- Smaller tool schema → faster, more detailed response

### Phase 2: Extraction (insights, tasks, risks, highlights)  
- Focused prompt demanding exhaustive extraction
- With minimums enforced: 10-20 insights, 8-15 tasks, 5-8 risks, 10-20 highlights
- Separate tool schema → model has full token budget for quantity

### Implementation Details

| File | Change |
|---|---|
| `supabase/functions/meeting-analyze/index.ts` | Split into two sequential Gemini calls. Phase 1 generates summary/ata/mindmap/participants. Phase 2 generates insights/tasks/risks/highlights. Each has its own focused prompt and smaller tool schema. Progress updates between phases (90% → 95% → 100%). Increase minimum requirements in Phase 2 prompt. |

### Why This Works
- Each call has a simpler schema → Gemini spends tokens on content depth, not structure breadth
- Phase 2 prompt can be very aggressive about quantity since it's not also generating ata/mindmap
- Total time increases slightly but each individual call stays well within limits
- For very long transcriptions, each phase gets the full 120s timeout independently

