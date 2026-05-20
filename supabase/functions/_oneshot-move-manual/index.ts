import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const OLD = "1ee5b9de-4864-475f-9602-ee039197e46e/comunicados/manual-chat-v1.pdf";
  const NEW = "3daf9772-404f-42f4-adbf-8a2566d91870/comunicados/manual-chat-v1.pdf";

  const dl = await sb.storage.from("chat-anexos").download(OLD);
  if (dl.error) return new Response(JSON.stringify({ step: "download", error: dl.error.message }), { status: 500 });
  const buf = new Uint8Array(await dl.data.arrayBuffer());

  const up = await sb.storage.from("chat-anexos").upload(NEW, buf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (up.error) return new Response(JSON.stringify({ step: "upload", error: up.error.message }), { status: 500 });

  const rm = await sb.storage.from("chat-anexos").remove([OLD]);

  const { error: updErr } = await sb
    .from("mensagens_anexos")
    .update({ storage_path: NEW })
    .eq("id", "18e6cc84-8cef-4f27-96a1-8ba62515b076");
  if (updErr) return new Response(JSON.stringify({ step: "db", error: updErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, bytes: buf.length, removed: !rm.error }), {
    headers: { "Content-Type": "application/json" },
  });
});
