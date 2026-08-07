import type { CalendarEvent } from "@/components/calendario/types";

/**
 * Geração de arquivos iCalendar (RFC 5545) para o Calendário Geral.
 *
 * Datas são tratadas como locais de America/Sao_Paulo: eventos de dia inteiro
 * usam VALUE=DATE e eventos com horário usam TZID=America/Sao_Paulo, evitando
 * o deslocamento de fuso que ocorreria ao converter para UTC no cliente.
 */

const TZID = "America/Sao_Paulo";

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Quebra linhas com mais de 75 octetos conforme a RFC. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function toDateValue(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Soma dias a uma data Y-M-D sem passar por Date/UTC. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
  const dd = `${dt.getDate()}`.padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function timeValue(hhmm: string): string {
  const [h = "00", m = "00", s = "00"] = hhmm.split(":");
  return `${h.padStart(2, "0")}${m.padStart(2, "0")}${s.padStart(2, "0")}`;
}

function stamp(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export interface IcsEventInput {
  uid: string;
  titulo: string;
  descricao?: string | null;
  local?: string | null;
  dataInicio: string;            // Y-M-D
  dataFim?: string | null;       // Y-M-D (inclusivo)
  horaInicio?: string | null;    // HH:mm
  horaFim?: string | null;       // HH:mm
  categoria?: string | null;
  status?: string | null;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildIcs(eventos: IcsEventInput[], calendarName = "Calendário Geral"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendario Geral//PT-BR//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
  ];

  const dtstamp = stamp();

  for (const ev of eventos) {
    if (!ev.dataInicio) continue;
    const fim = ev.dataFim || ev.dataInicio;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (ev.horaInicio) {
      lines.push(`DTSTART;TZID=${TZID}:${toDateValue(ev.dataInicio)}T${timeValue(ev.horaInicio)}`);
      lines.push(
        `DTEND;TZID=${TZID}:${toDateValue(fim)}T${timeValue(ev.horaFim || ev.horaInicio)}`,
      );
    } else {
      // DTEND é exclusivo em eventos de dia inteiro.
      lines.push(`DTSTART;VALUE=DATE:${toDateValue(ev.dataInicio)}`);
      lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(fim, 1))}`);
    }

    lines.push(`SUMMARY:${escapeText(ev.titulo)}`);
    if (ev.descricao) lines.push(`DESCRIPTION:${escapeText(ev.descricao)}`);
    if (ev.local) lines.push(`LOCATION:${escapeText(ev.local)}`);
    if (ev.categoria) lines.push(`CATEGORIES:${escapeText(ev.categoria)}`);
    if (ev.status === "concluida") lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

/** Converte os eventos já filtrados da tela para o formato do ICS. */
export function calendarEventsToIcs(events: CalendarEvent[]): IcsEventInput[] {
  return events
    .filter((ev) => ev.data_inicio || ev.data_prazo)
    .map((ev) => {
      const inicio = ev.data_inicio || ev.data_prazo!;
      const partes = [
        ev.descricao || "",
        ev.projeto ? `Projeto: ${ev.projeto.nome}` : "",
        ev.responsavel ? `Responsável: ${ev.responsavel.nome}` : "",
      ].filter(Boolean);
      return {
        uid: `${ev.id}@calendario-geral`,
        titulo: ev.tipo === "tarefa" && ev.projeto ? `${ev.titulo}` : ev.titulo,
        descricao: partes.join("\n") || null,
        local: ev.local ?? null,
        dataInicio: inicio,
        dataFim: ev.data_prazo || inicio,
        horaInicio: ev.hora_inicio ?? null,
        horaFim: ev.hora_fim ?? null,
        categoria: ev.categoria ?? (ev.tipo === "tarefa" ? "Tarefa" : null),
        status: ev.status,
      };
    });
}

/** Dispara o download do arquivo .ics no navegador. */
export function downloadIcs(conteudo: string, nomeArquivo = "calendario-geral.ics") {
  const blob = new Blob([conteudo], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
