// supabase/functions/gdrive-sync-documento/index.ts
// Espelha um documento do cofre de briefing para o Google Drive da agência.
// - Garante hierarquia: raiz → tipo → briefing → categoria
// - Faz upload multipart via connector gateway
// - Atualiza briefing_documentos.drive_sync_status

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";
const DRIVE_API = `${GATEWAY_BASE}/drive/v3`;
const DRIVE_UPLOAD = `${GATEWAY_BASE}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;

const CATEGORIA_LABELS: Record<string, string> = {
  geral: "Geral",
  orcamento: "Orçamento",
  nf: "Nota Fiscal",
  art: "ART",
  embalagem: "Embalagem",
  materia_prima: "Matéria-prima",
  evidencia: "Evidência",
  contrato: "Contrato",
  briefing: "Briefing",
};

const BodySchema = z.object({
  documento_id: z.string().uuid(),
}).strict();

function sanitizeName(s: string): string {
  return (s || "Sem nome").replace(/[\/\\:*?"<>|]+/g, "-").trim().slice(0, 180);
}

function gatewayHeaders() {
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const drive = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovable) throw new Error("LOVABLE_API_KEY ausente");
  if (!drive) throw new Error("not_configured");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": drive,
  };
}

async function findOrCreateFolder(
  name: string,
  parentId: string | null,
  sharedDriveId: string | null,
): Promise<string> {
  const headers = gatewayHeaders();
  const safe = sanitizeName(name).replace(/'/g, "\\'");
  const parentClause = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const q = `name='${safe}' and mimeType='application/vnd.google-apps.folder' and ${parentClause} and trashed=false`;

  const listParams = new URLSearchParams({
    q,
    fields: "files(id,name)",
    pageSize: "1",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (sharedDriveId) {
    listParams.set("corpora", "drive");
    listParams.set("driveId", sharedDriveId);
  }

  const listRes = await fetch(`${DRIVE_API}/files?${listParams}`, { headers });
  if (!listRes.ok) {
    const t = await listRes.text();
    throw new Error(`drive_list_failed[${listRes.status}]: ${t.slice(0, 200)}`);
  }
  const listData = await listRes.json();
  if (listData.files?.[0]?.id) return listData.files[0].id as string;

  const body: Record<string, unknown> = {
    name: sanitizeName(name),
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) body.parents = [parentId];
  else if (sharedDriveId) body.parents = [sharedDriveId];

  const createRes = await fetch(
    `${DRIVE_API}/files?supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!createRes.ok) {
    const t = await createRes.text();
    throw new Error(`drive_folder_create_failed[${createRes.status}]: ${t.slice(0, 200)}`);
  }
  const created = await createRes.json();
  return created.id as string;
}

async function uploadFile(
  parentId: string,
  filename: string,
  mimeType: string,
  data: Uint8Array,
): Promise<{ id: string; webViewLink: string }> {
  const headers = gatewayHeaders();
  const boundary = "lovable_" + crypto.randomUUID().replace(/-/g, "");
  const metadata = {
    name: sanitizeName(filename),
    parents: [parentId],
  };
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(head.length + data.length + tail.length);
  body.set(head, 0);
  body.set(data, head.length);
  body.set(tail, head.length + data.length);

  const res = await fetch(
    `${DRIVE_UPLOAD}&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`drive_upload_failed[${res.status}]: ${t.slice(0, 300)}`);
  }
  return await res.json();
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 60, rateLimitPrefix: "gdrive-sync-documento" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const { documento_id } = parsed.data;
      const start = Date.now();

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Carrega config
      const { data: cfg } = await sb
        .from("google_drive_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!cfg) {
        return new Response(
          JSON.stringify({ ok: false, error: "not_configured" }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      if (cfg.connection_status !== "conectado") {
        await sb.from("briefing_documentos").update({
          drive_sync_status: "erro",
          drive_sync_error: "Conexão com Google Drive não está ativa",
        }).eq("id", documento_id);
        return new Response(
          JSON.stringify({ ok: false, error: "not_configured" }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // Carrega documento + briefing
      const { data: doc } = await sb
        .from("briefing_documentos")
        .select("*, briefings:briefing_id(id,titulo,tipo,google_drive_folder_id,google_drive_folder_url)")
        .eq("id", documento_id)
        .maybeSingle();
      if (!doc || !doc.storage_path) {
        return new Response(
          JSON.stringify({ ok: false, error: "documento_sem_arquivo" }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const briefing = (doc as any).briefings;

      try {
        // Marca pendente
        await sb.from("briefing_documentos").update({
          drive_sync_status: "pendente",
          drive_sync_error: null,
        }).eq("id", documento_id);

        // 1. Raiz
        let rootId = cfg.root_folder_id as string | null;
        if (!rootId) {
          rootId = await findOrCreateFolder(
            cfg.root_folder_name || "Bimaster — Briefings",
            null,
            cfg.shared_drive_id,
          );
          await sb.from("google_drive_config").update({ root_folder_id: rootId }).eq("id", cfg.id);
        }

        // 2. Tipo
        const tipoLabel = briefing?.tipo || "Outros";
        const tipoFolderId = await findOrCreateFolder(tipoLabel, rootId, cfg.shared_drive_id);

        // 3. Briefing
        let briefingFolderId = briefing?.google_drive_folder_id as string | null;
        if (!briefingFolderId) {
          const folderName = `${briefing?.titulo || "Briefing"} — ${String(briefing?.id || "").slice(0, 8)}`;
          briefingFolderId = await findOrCreateFolder(folderName, tipoFolderId, cfg.shared_drive_id);
          const folderUrl = `https://drive.google.com/drive/folders/${briefingFolderId}`;
          await sb.from("briefings").update({
            google_drive_folder_id: briefingFolderId,
            google_drive_folder_url: folderUrl,
          }).eq("id", briefing.id);
        }

        // 4. Categoria
        const catLabel = CATEGORIA_LABELS[doc.categoria] || "Geral";
        const catFolderId = await findOrCreateFolder(catLabel, briefingFolderId!, cfg.shared_drive_id);

        // 5. Baixar do storage
        const { data: fileBlob, error: dlErr } = await sb.storage
          .from("briefing-cofre").download(doc.storage_path);
        if (dlErr || !fileBlob) throw new Error(`storage_download_failed: ${dlErr?.message || ""}`);
        const bytes = new Uint8Array(await fileBlob.arrayBuffer());

        // 6. Upload
        const filename = doc.storage_path.split("/").pop() || doc.nome || "arquivo";
        const uploaded = await uploadFile(
          catFolderId,
          filename,
          doc.mime_type || "application/octet-stream",
          bytes,
        );

        await sb.from("briefing_documentos").update({
          google_drive_file_id: uploaded.id,
          google_drive_url: uploaded.webViewLink,
          google_drive_folder_id: catFolderId,
          drive_sync_status: "enviado",
          drive_sync_error: null,
          enviado_drive_em: new Date().toISOString(),
        }).eq("id", documento_id);

        await sb.from("google_drive_sync_log").insert({
          documento_id, briefing_id: briefing?.id,
          acao: "upload", status: "ok",
          drive_file_id: uploaded.id, drive_folder_id: catFolderId,
          duration_ms: Date.now() - start, created_by: ctx.userId,
        });

        return new Response(
          JSON.stringify({ ok: true, drive_url: uploaded.webViewLink, drive_file_id: uploaded.id }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb.from("briefing_documentos").update({
          drive_sync_status: "erro",
          drive_sync_error: msg.slice(0, 500),
        }).eq("id", documento_id);
        await sb.from("google_drive_sync_log").insert({
          documento_id, briefing_id: briefing?.id,
          acao: "upload", status: "erro",
          error_message: msg.slice(0, 500),
          duration_ms: Date.now() - start, created_by: ctx.userId,
        });
        return new Response(
          JSON.stringify({ ok: false, error: msg }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    },
  ),
);
