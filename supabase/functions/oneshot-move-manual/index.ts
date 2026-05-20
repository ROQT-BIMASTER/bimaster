import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

Deno.serve(async (req) => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const NEW = "3daf9772-404f-42f4-adbf-8a2566d91870/comunicados/manual-chat-v1.pdf";
  const { b64 } = await req.json();
  const bytes = decodeBase64(b64);

  const up = await sb.storage.from("chat-anexos").upload(NEW, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (up.error) return new Response(JSON.stringify({ step: "upload", error: up.error.message }), { status: 500 });

  const { error: updErr } = await sb
    .from("mensagens_anexos")
    .update({ storage_path: NEW, size_bytes: bytes.length })
    .eq("id", "18e6cc84-8cef-4f27-96a1-8ba62515b076");
  if (updErr) return new Response(JSON.stringify({ step: "db", error: updErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, bytes: bytes.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
