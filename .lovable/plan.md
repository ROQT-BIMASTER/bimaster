

# Security Hardening Plan (Zero Downtime)

All changes are backward-compatible with the production application. No breaking changes.

---

## Step 1: Add JWT Authentication to 5 Unprotected Edge Functions

Add authentication validation at the top of each function handler. The frontend already sends auth headers via `getAuthHeaders()` for ElevenLabs functions, and `supabase.functions.invoke` for sofia-voice-token.

**Files to edit:**
- `supabase/functions/elevenlabs-tts/index.ts`
- `supabase/functions/elevenlabs-sfx/index.ts`
- `supabase/functions/elevenlabs-music/index.ts`
- `supabase/functions/sofia-voice-token/index.ts`
- `supabase/functions/expense-ai-assistant/index.ts`

Pattern to add after CORS check:
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
const { data, error } = await supabaseClient.auth.getClaims(authHeader.replace("Bearer ", ""));
if (error || !data?.claims) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
```

**geocode-batch** already uses service role and is meant for admin/cron tasks -- will add API key validation instead of JWT (it's called server-side, not from the browser).

---

## Step 2: Remove Overly Permissive RLS on `cofre_share_tokens`

**Database migration:**
- Drop the `"Anon can read tokens for validation"` policy (the edge function uses service role key, so RLS is bypassed anyway)

```sql
DROP POLICY IF EXISTS "Anon can read tokens for validation" ON public.cofre_share_tokens;
```

---

## Step 3: Strengthen Share Token from 12 to 32 Characters

**File:** `src/components/fabrica/CofreFullscreenModal.tsx`

Change token generation from 12 chars to 32 chars using `crypto.getRandomValues()` for cryptographic randomness.

---

## Step 4: Make `fabrica-produto-fotos` Bucket Private

**Database migration:**
```sql
UPDATE storage.buckets SET public = false WHERE id = 'fabrica-produto-fotos';
```

**Frontend:** Search for all usages of `getPublicUrl` on this bucket and replace with `createSignedUrl`. This bucket is used for product photos in the factory module.

---

## Step 5: Add Rate Limiting to `cofre-share` Edge Function

**File:** `supabase/functions/cofre-share/index.ts`

Add IP-based rate limiting using KV/in-memory map (10 requests/min per IP). Log access with IP and user-agent for audit trail.

---

## Impact Assessment

| Change | Breaking? | Risk |
|--------|-----------|------|
| JWT on ElevenLabs functions | No -- frontend already sends auth headers | None |
| JWT on expense-ai-assistant | No -- frontend already sends auth header | None |
| Drop anon RLS on cofre_share_tokens | No -- edge function uses service role | None |
| 32-char tokens | No -- only affects new tokens | None |
| Private fabrica-produto-fotos | Low -- need to update `getPublicUrl` calls | Low |
| Rate limiting on cofre-share | No -- legitimate use well under 10/min | None |

