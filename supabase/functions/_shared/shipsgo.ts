// _shared/shipsgo.ts — Helpers para integração com a API ShipsGo v2
// Docs: https://api.shipsgo.com/docs/v2/

const SHIPSGO_BASE = "https://api.shipsgo.com/v2";

export interface ShipsgoCallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export class ShipsgoError extends Error {
  constructor(public status: number, public body: string) {
    super(`ShipsGo API error [${status}]: ${body}`);
    this.name = "ShipsgoError";
  }
}

function getToken(): string {
  const token = Deno.env.get("SHIPSGO_API_TOKEN");
  if (!token) throw new Error("SHIPSGO_API_TOKEN não configurado");
  return token;
}

export async function shipsgoFetch<T = unknown>(
  path: string,
  opts: ShipsgoCallOptions = {},
): Promise<T> {
  const token = getToken();
  const url = new URL(`${SHIPSGO_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      "X-Shipsgo-User-Token": token,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ShipsgoError(res.status, text);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Normaliza um shipment Ocean da ShipsGo para o formato armazenado em
 * `shipsgo_shipments`. A API retorna estruturas que podem variar entre
 * envios; este helper é defensivo e cobre os campos que utilizamos.
 */
export function mapOceanShipment(remote: any) {
  const pol = remote?.port_of_loading ?? remote?.pol ?? {};
  const pod = remote?.port_of_discharge ?? remote?.pod ?? {};
  const carrier = remote?.carrier ?? {};
  const lastEvent =
    Array.isArray(remote?.events) && remote.events.length > 0
      ? remote.events[remote.events.length - 1]
      : null;

  return {
    shipsgo_id: String(remote?.id ?? remote?.shipment_id ?? ""),
    container_number: remote?.container_number ?? null,
    bl_number: remote?.bl_number ?? remote?.bill_of_lading ?? null,
    booking_number: remote?.booking_number ?? null,
    carrier_code: carrier?.code ?? carrier?.scac ?? null,
    carrier_name: carrier?.name ?? null,
    status: (remote?.status ?? "UNKNOWN").toString().toUpperCase(),
    pol_name: pol?.name ?? null,
    pol_country: pol?.country ?? pol?.country_code ?? null,
    pol_unlocode: pol?.unlocode ?? null,
    pod_name: pod?.name ?? null,
    pod_country: pod?.country ?? pod?.country_code ?? null,
    pod_unlocode: pod?.unlocode ?? null,
    eta_original: remote?.eta_original ?? remote?.original_eta ?? null,
    eta_atual: remote?.eta ?? remote?.estimated_arrival ?? null,
    ata: remote?.ata ?? remote?.actual_arrival ?? null,
    data_embarque: remote?.departure_date ?? remote?.atd ?? null,
    last_event_at: lastEvent?.timestamp ?? lastEvent?.event_at ?? null,
    last_event_description: lastEvent?.description ?? lastEvent?.event_type ?? null,
    last_event_location: lastEvent?.location?.name ?? null,
  };
}

export function mapOceanEvents(remote: any): Array<Record<string, unknown>> {
  const events = Array.isArray(remote?.events) ? remote.events : [];
  return events.map((e: any) => ({
    event_type: e?.event_type ?? null,
    event_code: e?.event_code ?? e?.code ?? null,
    description: e?.description ?? null,
    location_name: e?.location?.name ?? null,
    location_unlocode: e?.location?.unlocode ?? null,
    vessel_name: e?.vessel?.name ?? null,
    voyage_number: e?.voyage_number ?? null,
    event_at: e?.timestamp ?? e?.event_at ?? null,
    is_actual: e?.is_actual ?? true,
    raw: e,
  }));
}

/**
 * Constant-time HMAC-SHA256 verification para validar webhooks ShipsGo.
 * A assinatura chega no header `X-Shipsgo-Webhook-Signature` (hex).
 */
export async function verifyShipsgoSignature(
  rawBody: string,
  signatureHex: string | null,
): Promise<boolean> {
  if (!signatureHex) return false;
  const secret = Deno.env.get("SHIPSGO_WEBHOOK_SECRET");
  if (!secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare
  if (computed.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}
