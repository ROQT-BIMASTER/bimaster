// Feed iCalendar (RFC 5545) do Calendário Geral, autenticado por token opaco.
// Assinatura: GET /functions/v1/calendario-ics?token=<token>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const TZID = "America/Sao_Paulo";

function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

const compact = (iso: string) => iso.replace(/-/g, "");
const compactTime = (hhmm: string) => hhmm.replace(/:/g, "").padEnd(6, "0");

function addDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

interface Row {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  data_inicio: string;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

function buildIcs(rows: Row[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendario Geral//PT-BR//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Calendário Geral",
    `X-WR-TIMEZONE:${TZID}`,
  ];

  for (const r of rows) {
    const fim = r.data_fim || r.data_inicio;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${r.id}@calendario-geral`);
    lines.push(`DTSTAMP:${stamp}`);
    if (r.hora_inicio) {
      lines.push(`DTSTART;TZID=${TZID}:${compact(r.data_inicio)}T${compactTime(r.hora_inicio)}`);
      lines.push(
        `DTEND;TZID=${TZID}:${compact(fim)}T${compactTime(r.hora_fim || r.hora_inicio)}`,
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(r.data_inicio)}`);
      lines.push(`DTEND;VALUE=DATE:${compact(addDay(fim))}`);
    }
    lines.push(`SUMMARY:${escapeText(r.titulo)}`);
    if (r.descricao) lines.push(`DESCRIPTION:${escapeText(r.descricao)}`);
    if (r.local) lines.push(`LOCATION:${escapeText(r.local)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token.length < 16) {
    return new Response("Token inválido.", { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: tokenRow, error: tokenErr } = await admin
    .from("calendario_ics_tokens")
    .select("user_id, filtros")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return new Response("Token inválido.", { status: 401 });
  }

  const filtros = (tokenRow.filtros || {}) as { responsavelIds?: string[] };

  // Somente eventos avulsos visíveis ao dono do token (autor ou participante).
  const { data: participacoes } = await admin
    .from("calendario_evento_participantes")
    .select("evento_id")
    .eq("user_id", tokenRow.user_id);

  const idsParticipa = (participacoes || []).map((p: { evento_id: string }) => p.evento_id);

  let query = admin
    .from("calendario_eventos")
    .select("id, titulo, descricao, local, data_inicio, data_fim, hora_inicio, hora_fim, criado_por")
    .order("data_inicio", { ascending: true })
    .limit(2000);

  query = idsParticipa.length
    ? query.or(`criado_por.eq.${tokenRow.user_id},id.in.(${idsParticipa.join(",")})`)
    : query.eq("criado_por", tokenRow.user_id);

  const { data: eventos, error } = await query;
  if (error) {
    return new Response("Falha ao gerar o calendário.", { status: 500 });
  }

  let rows = (eventos || []) as Array<Row & { criado_por: string }>;
  const respFiltro = filtros.responsavelIds;
  if (respFiltro?.length) {
    rows = rows.filter((r) => respFiltro.includes(r.criado_por));
  }

  await admin
    .from("calendario_ics_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  return new Response(buildIcs(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="calendario-geral.ics"',
      "Cache-Control": "private, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
