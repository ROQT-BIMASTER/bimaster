// crm-blip-backfill — carrega histórico de threads/mensagens de um bot Blip.
// Autenticado (JWT). Body: { botId: uuid, threads?: number, messagesPerThread?: number }
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  botId: z.string().uuid(),
  threads: z.number().int().min(1).max(200).default(20),
  messagesPerThread: z.number().int().min(1).max(200).default(50),
}).strict();

type BlipResource<T> = {
  total?: number;
  items?: T[];
  itemType?: string;
};

type BlipCommandResponse<T> = {
  id: string;
  method: string;
  status: "success" | "failure";
  resource?: BlipResource<T> | T;
  reason?: { code: number; description: string };
};

type ThreadIdentity = {
  identity?: string;
  ownerIdentity?: string;
  lastMessageDate?: string;
  unreadCount?: number;
};

type ThreadMessage = {
  id?: string;
  from?: string;
  to?: string;
  direction?: "sent" | "received";
  type?: string;
  content?: unknown;
  date?: string;
  storageDate?: string;
  metadata?: Record<string, unknown>;
};

const BLIP_ENDPOINTS = {
  prod: "https://http.msging.net/commands",
  hmg: "https://hmg.http.msging.net/commands",
} as const;

function toBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function buildAuthValue(
  format: "raw" | "identifier_pair",
  key: string,
  identifier: string | null,
): string {
  if (format === "identifier_pair" && identifier) return toBase64(`${identifier}:${key}`);
  return key;
}

async function blipCommand<T>(
  authValue: string,
  endpoint: string,
  uri: string,
  method = "get",
): Promise<BlipCommandResponse<T>> {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${authValue}` },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      to: "postmaster@msging.net",
      method,
      uri,
    }),
  });
  const text = await resp.text();
  try { return JSON.parse(text) as BlipCommandResponse<T>; }
  catch { throw new Error(`Blip resp inválida (${resp.status}): ${text.slice(0, 200)}`); }
}

function parseIdentity(s: string | undefined): { external: string; phone: string | null } {
  if (!s) return { external: "", phone: null };
  const base = s.split("/")[0];
  const node = base.split("@")[0];
  const phone = /^\d{8,15}$/.test(node) ? node : null;
  return { external: base, phone };
}

function extractText(content: unknown): { tipo: string; texto: string | null; mime: string | null; url: string | null } {
  if (typeof content === "string") return { tipo: "text", texto: content, mime: null, url: null };
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c.text === "string") return { tipo: "text", texto: c.text, mime: null, url: null };
    if (typeof c.uri === "string") {
      const mime = typeof c.type === "string" ? (c.type as string) : null;
      const tipo = mime?.startsWith("image/") ? "image"
        : mime?.startsWith("audio/") ? "audio"
        : mime?.startsWith("video/") ? "video" : "file";
      return { tipo, texto: typeof c.title === "string" ? c.title as string : null, mime, url: c.uri as string };
    }
  }
  try { return { tipo: "text", texto: JSON.stringify(content), mime: null, url: null }; }
  catch { return { tipo: "text", texto: null, mime: null, url: null }; }
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 5, rateLimitPrefix: "crm-blip-backfill" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { botId, threads, messagesPerThread } = parsed.data;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Credenciais completas do bot (chave + identifier + formato + ambiente)
    const { data: authRows, error: keyErr } = await sb.rpc("crm_bot_get_auth", { p_bot_id: botId });
    const authRow = Array.isArray(authRows) ? authRows[0] : authRows;
    if (keyErr || !authRow?.bot_key) {
      return new Response(JSON.stringify({ error: "bot/chave não encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const key = authRow.bot_key as string;
    const identifier = (authRow.identificador_externo as string | null) ?? null;
    const authFormat = (authRow.auth_format as "raw" | "identifier_pair") ?? "raw";
    const environment = (authRow.environment as "prod" | "hmg") ?? "prod";
    const endpoint = BLIP_ENDPOINTS[environment];
    const authValue = buildAuthValue(authFormat, key, identifier);

    const summary = {
      threads_found: 0,
      messages_ingested: 0,
      messages_duplicated: 0,
      errors: [] as Array<{ at: string; error: string }>,
    };

    try {
      // 2) Lista threads
      const tResp = await blipCommand<ThreadIdentity>(authValue, endpoint, `/threads?$take=${threads}`);
      if (tResp.status !== "success") {
        throw new Error(tResp.reason?.description ?? "Falha ao listar threads");
      }
      const threadItems = (tResp.resource as BlipResource<ThreadIdentity>)?.items ?? [];
      summary.threads_found = threadItems.length;

      // 3) Para cada thread, busca mensagens
      for (const t of threadItems) {
        const identity = t.identity ?? t.ownerIdentity;
        if (!identity) continue;
        try {
          const mResp = await blipCommand<ThreadMessage>(
            key as string,
            `/threads/${encodeURIComponent(identity)}?$take=${messagesPerThread}`,
          );
          if (mResp.status !== "success") {
            summary.errors.push({ at: identity, error: mResp.reason?.description ?? "falha" });
            continue;
          }
          const msgs = (mResp.resource as BlipResource<ThreadMessage>)?.items ?? [];
          for (const m of msgs) {
            const dir: "in" | "out" = m.direction === "sent" ? "out" : (m.from ? "in" : "out");
            const fromId = parseIdentity(m.from);
            const toId = parseIdentity(m.to);
            const externalThread = dir === "in" ? fromId.external : toId.external;
            const phone = dir === "in" ? fromId.phone : toId.phone;
            const parsedMsg = extractText(m.content);
            const meta = (m.metadata ?? {}) as Record<string, unknown>;
            const name = typeof meta["#messageEmitter"] === "string"
              ? meta["#messageEmitter"] as string : null;

            const { data: row, error: ingErr } = await sb.rpc("crm_ingest_message", {
              p_bot_id: botId,
              p_external_thread: externalThread || identity,
              p_blip_msg_id: m.id ?? null,
              p_direction: dir,
              p_tipo: parsedMsg.tipo as "text" | "image" | "audio" | "video" | "file",
              p_conteudo: parsedMsg.texto,
              p_midia_url: parsedMsg.url,
              p_midia_mime: parsedMsg.mime,
              p_contato_nome: name,
              p_contato_telefone: phone,
              p_contato_email: null,
              p_criada_em: m.storageDate ?? m.date ?? new Date().toISOString(),
              p_metadata: meta,
            });
            if (ingErr) {
              summary.errors.push({ at: `${identity}#${m.id}`, error: ingErr.message });
              continue;
            }
            const r = Array.isArray(row) ? row[0] : row;
            if (r?.duplicated) summary.messages_duplicated++;
            else summary.messages_ingested++;
          }
        } catch (e) {
          summary.errors.push({ at: identity, error: e instanceof Error ? e.message : String(e) });
        }
      }

      await sb.rpc("crm_bot_touch_sync", { p_bot_id: botId, p_erro: null });
      return new Response(JSON.stringify({ ok: true, ...summary }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.rpc("crm_bot_touch_sync", { p_bot_id: botId, p_erro: msg });
      return new Response(JSON.stringify({ ok: false, error: msg, summary }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
));
