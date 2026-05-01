// shipsgo-diff-detect — calcula divergências entre china_embarques e shipsgo_shipments.
// Retorna lista tipada (Tab 2) e payloads agregados para a IA (Tab 3).
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

type Divergencia =
  | "ORFAO_LOCAL"
  | "ORFAO_SHIPSGO"
  | "ETA_DIVERGENTE"
  | "STATUS_DIVERGENTE"
  | "STALE"
  | "WEBHOOK_FALHO"
  | "OK";

function diffDays(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round(Math.abs(da - db) / 86_400_000);
}

const STATUS_MAP: Record<string, string[]> = {
  // status local => possíveis status ShipsGo equivalentes
  EM_TRANSITO: ["IN_TRANSIT", "SAILING", "DEPARTED"],
  EMBARCADO: ["DEPARTED", "SAILING", "IN_TRANSIT"],
  CHEGOU: ["ARRIVED", "DELIVERED", "DISCHARGED"],
  ENTREGUE: ["DELIVERED", "GATE_OUT"],
};

function statusOk(local: string | null, remoto: string | null): boolean {
  if (!local || !remoto) return true;
  const allowed = STATUS_MAP[local.toUpperCase()];
  if (!allowed) return true;
  return allowed.includes(remoto.toUpperCase());
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "shipsgo-diff-detect" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const json = { ...cors, "Content-Type": "application/json" };

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Admin gate
      const { data: roleRow } = await sb
        .from("user_roles").select("role").eq("user_id", ctx.userId!)
        .eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Acesso restrito" }), { status: 403, headers: json });
      }

      const [{ data: embarques }, { data: shipments }, { data: webhookFails }] = await Promise.all([
        sb.from("china_embarques")
          .select("id, numero_container, numero_bl, status, data_eta, navio, ordem_compra_id, updated_at"),
        sb.from("shipsgo_shipments")
          .select("id, embarque_id, container_number, bl_number, status, eta_atual, dias_atraso, last_event_at, last_event_description, updated_at, shipsgo_id")
          .is("deleted_at", null),
        sb.from("shipsgo_webhook_log")
          .select("id, shipsgo_id, error_message, received_at")
          .not("error_message", "is", null)
          .gte("received_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
      ]);

      const shipByEmbarque = new Map<string, any>();
      const shipByContainer = new Map<string, any>();
      for (const s of shipments ?? []) {
        if (s.embarque_id) shipByEmbarque.set(s.embarque_id, s);
        if (s.container_number) shipByContainer.set(s.container_number, s);
      }

      const failedShipsgoIds = new Set((webhookFails ?? []).map((w) => w.shipsgo_id).filter(Boolean));
      const matchedShipIds = new Set<string>();
      const linhas: any[] = [];
      const now = Date.now();
      const STALE_MS = 7 * 86_400_000;

      for (const e of embarques ?? []) {
        const ship = (e.id && shipByEmbarque.get(e.id))
          || (e.numero_container && shipByContainer.get(e.numero_container));

        if (!ship) {
          if (e.numero_container || e.numero_bl) {
            linhas.push({
              tipo: "ORFAO_LOCAL" as Divergencia,
              embarque_id: e.id, container: e.numero_container, bl: e.numero_bl,
              status_local: e.status, status_shipsgo: null,
              eta_local: e.data_eta, eta_shipsgo: null,
              ultima_atualizacao: e.updated_at,
              detalhe: "Embarque tem container/BL mas não há tracking ShipsGo associado",
            });
          }
          continue;
        }
        matchedShipIds.add(ship.id);

        const tipos: Divergencia[] = [];
        const etaDiff = diffDays(e.data_eta, ship.eta_atual);
        if (etaDiff !== null && etaDiff > 1) tipos.push("ETA_DIVERGENTE");
        if (!statusOk(e.status, ship.status)) tipos.push("STATUS_DIVERGENTE");
        const ageMs = ship.updated_at ? now - new Date(ship.updated_at).getTime() : Infinity;
        if (ageMs > STALE_MS) tipos.push("STALE");
        if (failedShipsgoIds.has(ship.shipsgo_id)) tipos.push("WEBHOOK_FALHO");

        if (tipos.length === 0) continue;
        for (const t of tipos) {
          linhas.push({
            tipo: t, embarque_id: e.id, shipment_id: ship.id,
            container: ship.container_number ?? e.numero_container,
            bl: ship.bl_number ?? e.numero_bl,
            status_local: e.status, status_shipsgo: ship.status,
            eta_local: e.data_eta, eta_shipsgo: ship.eta_atual,
            dias_atraso: ship.dias_atraso,
            ultima_atualizacao: ship.updated_at,
            detalhe:
              t === "ETA_DIVERGENTE" ? `ETA difere em ${etaDiff} dias` :
              t === "STATUS_DIVERGENTE" ? `Status local ${e.status} ≠ ShipsGo ${ship.status}` :
              t === "STALE" ? "Sem atualização há mais de 7 dias" :
              t === "WEBHOOK_FALHO" ? "Último webhook teve erro" : "",
          });
        }
      }

      // Órfãos no ShipsGo
      for (const s of shipments ?? []) {
        if (matchedShipIds.has(s.id)) continue;
        if (!s.embarque_id) {
          linhas.push({
            tipo: "ORFAO_SHIPSGO" as Divergencia,
            shipment_id: s.id,
            container: s.container_number, bl: s.bl_number,
            status_local: null, status_shipsgo: s.status,
            eta_local: null, eta_shipsgo: s.eta_atual,
            ultima_atualizacao: s.updated_at,
            detalhe: "Tracking ShipsGo sem vínculo a embarque local",
          });
        }
      }

      // KPIs
      const kpis = {
        total_embarques: embarques?.length ?? 0,
        total_shipments: shipments?.length ?? 0,
        em_transito: (shipments ?? []).filter((s) => ["IN_TRANSIT", "SAILING", "DEPARTED"].includes((s.status ?? "").toUpperCase())).length,
        atrasados: (shipments ?? []).filter((s) => (s.dias_atraso ?? 0) > 0).length,
        sem_eta: (shipments ?? []).filter((s) => !s.eta_atual).length,
        webhook_falhos_7d: webhookFails?.length ?? 0,
        divergencias_total: linhas.length,
        por_tipo: linhas.reduce<Record<string, number>>((acc, l) => {
          acc[l.tipo] = (acc[l.tipo] ?? 0) + 1; return acc;
        }, {}),
      };

      return new Response(JSON.stringify({ kpis, divergencias: linhas }), { headers: json });
    },
  ),
);
