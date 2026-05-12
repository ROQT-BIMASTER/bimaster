// china-copilot-relatorios — CRUD/listagem dos relatórios persistidos do Copiloto.
// GET ?submissao_id=...                  → lista
// GET ?id=...                            → detalhe (markdown+analytics)
// GET ?id=...&download=pdf               → signed URL do PDF arquivado
// POST { id, pdf_base64, filename }      → arquiva PDF no bucket
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "china-copilot-pdf";

const PostBody = z.object({
  id: z.string().uuid(),
  pdf_base64: z.string().min(10).max(20_000_000),
  filename: z.string().max(200).optional(),
}).strict();

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 60, rateLimitPrefix: "china-copilot-rel" },
    async (req, _ctx) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      const url = new URL(req.url);

      if (req.method === "GET") {
        const id = url.searchParams.get("id");
        const submissaoId = url.searchParams.get("submissao_id");
        const download = url.searchParams.get("download");

        // Signed URL do PDF
        if (id && download === "pdf") {
          const { data: rel, error } = await sb
            .from("china_copilot_relatorios")
            .select("id, pdf_path")
            .eq("id", id)
            .maybeSingle();
          if (error || !rel) return jsonResponse({ error: "Relatório não encontrado" }, 404, cors);
          if (!rel.pdf_path) return jsonResponse({ error: "PDF ainda não arquivado" }, 404, cors);
          const { data: signed, error: sErr } = await sb.storage
            .from(BUCKET)
            .createSignedUrl(rel.pdf_path, 60);
          if (sErr || !signed) return jsonResponse({ error: sErr?.message ?? "Falha ao gerar URL" }, 500, cors);
          return jsonResponse({ url: signed.signedUrl }, 200, cors);
        }

        // Detalhe
        if (id) {
          const { data, error } = await sb
            .from("china_copilot_relatorios")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (error || !data) return jsonResponse({ error: "Relatório não encontrado" }, 404, cors);
          return jsonResponse({ relatorio: data }, 200, cors);
        }

        // Lista
        if (submissaoId) {
          const { data, error } = await sb
            .from("china_copilot_relatorios")
            .select("id, submissao_id, idioma, profundidade, model, pdf_path, gerado_por, created_at, kpis, submissao_snapshot")
            .eq("submissao_id", submissaoId)
            .order("created_at", { ascending: false })
            .limit(50);
          if (error) return jsonResponse({ error: error.message }, 500, cors);

          // Hidratar nomes (best-effort)
          const ids = Array.from(new Set((data ?? []).map((r: any) => r.gerado_por).filter(Boolean)));
          let nomes: Record<string, string> = {};
          if (ids.length > 0) {
            const { data: profs } = await sb.from("profiles").select("id, nome_completo, email").in("id", ids);
            for (const p of profs ?? []) nomes[p.id] = (p as any).nome_completo || (p as any).email || "—";
          }
          const itens = (data ?? []).map((r: any) => ({ ...r, gerado_por_nome: nomes[r.gerado_por] ?? null }));
          return jsonResponse({ itens }, 200, cors);
        }

        return jsonResponse({ error: "Informe id ou submissao_id" }, 400, cors);
      }

      if (req.method === "POST") {
        let payload: unknown;
        try { payload = await req.json(); } catch { return jsonResponse({ error: "Body inválido" }, 400, cors); }
        const parsed = PostBody.safeParse(payload);
        if (!parsed.success) return jsonResponse({ error: parsed.error.flatten() }, 400, cors);
        const { id, pdf_base64 } = parsed.data;

        const { data: rel, error: relErr } = await sb
          .from("china_copilot_relatorios")
          .select("id, submissao_id")
          .eq("id", id)
          .maybeSingle();
        if (relErr || !rel) return jsonResponse({ error: "Relatório não encontrado" }, 404, cors);

        const bytes = base64ToBytes(pdf_base64);
        if (bytes.length > 15 * 1024 * 1024) return jsonResponse({ error: "PDF acima do limite (15MB)" }, 413, cors);
        const path = `${rel.submissao_id}/${rel.id}.pdf`;
        const up = await sb.storage.from(BUCKET).upload(path, bytes, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (up.error) return jsonResponse({ error: up.error.message }, 500, cors);

        const { error: updErr } = await sb
          .from("china_copilot_relatorios")
          .update({ pdf_path: path })
          .eq("id", id);
        if (updErr) return jsonResponse({ error: updErr.message }, 500, cors);

        return jsonResponse({ ok: true, pdf_path: path }, 200, cors);
      }

      return jsonResponse({ error: "Método não suportado" }, 405, cors);
    },
  ),
);
