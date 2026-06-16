/**
 * Testes do contrato canônico de datas (colunas Postgres DATE).
 *
 * Executar nos 3 fusos: `bun run test:tz` (ver package.json).
 * Em UTC e em fusos negativos (SP) e positivos (Tóquio), os helpers
 * `parseLocalDate` + `formatLocalDate` DEVEM produzir o mesmo YYYY-MM-DD
 * que o usuário selecionou no `<Calendar>` do shadcn.
 */
import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import {
  parseLocalDate,
  parseLocalDateOrNow,
  formatLocalDate,
  todayBR,
  getCurrentHourBR,
  nowSaoPauloISO,
} from "@/lib/utils/parseLocalDate";

const DANGER_DATES = [
  "2026-01-01",
  "2026-03-15",
  "2026-06-16",
  "2026-10-15", // janela do antigo horário de verão BR
  "2026-12-31",
  "2024-02-29", // leap
];

describe("parseLocalDate / formatLocalDate — round-trip", () => {
  for (const s of DANGER_DATES) {
    it(`round-trip preserva ${s} (TZ=${process.env.TZ ?? "host"})`, () => {
      const d = parseLocalDate(s)!;
      expect(d).not.toBeNull();
      expect(formatLocalDate(d)).toBe(s);
    });
  }

  it("aceita null/undefined/'' como null", () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate("")).toBeNull();
  });

  it("aceita Date como entrada (passthrough)", () => {
    const d = new Date(2026, 5, 16);
    expect(parseLocalDate(d)).toBe(d);
  });

  it("parseLocalDateOrNow devolve Date válido quando entrada vazia", () => {
    const r = parseLocalDateOrNow(null);
    expect(r).toBeInstanceOf(Date);
    expect(Number.isNaN(r.getTime())).toBe(false);
  });

  it("formatLocalDate(null|undefined) → null", () => {
    expect(formatLocalDate(null)).toBeNull();
    expect(formatLocalDate(undefined)).toBeNull();
  });
});

describe("Contrato com o shadcn <Calendar> (Date local midnight)", () => {
  // O Calendar entrega `new Date(year, monthIndex, day)` à meia-noite local.
  it("Date local midnight de 16-jun-2026 formata como '2026-06-16' em qualquer fuso", () => {
    const d = new Date(2026, 5, 16);
    expect(formatLocalDate(d)).toBe("2026-06-16");
  });

  it("Date local midnight de 01-jan-2026 formata como '2026-01-01' em qualquer fuso", () => {
    expect(formatLocalDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("Date local midnight de 31-dez-2026 formata como '2026-12-31' em qualquer fuso", () => {
    expect(formatLocalDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("Anti-padrão documentado (motivação dos helpers)", () => {
  // Esses asserts servem de regressão viva: provam o motivo dos helpers existirem.
  // O comportamento varia por fuso; cada bloco roda só quando faz sentido.
  it("em SP, `new Date('2026-06-16').toISOString().slice(0,10)` produz o dia anterior", () => {
    if (process.env.TZ !== "America/Sao_Paulo") return;
    // new Date("YYYY-MM-DD") → UTC midnight → em SP (UTC-3) é 15-jun 21:00
    const bug = new Date("2026-06-16").toISOString().slice(0, 10);
    expect(bug).toBe("2026-06-16"); // ISO retorna UTC, então a string ISO é a mesma
    // O bug aparece quando convertemos uma Date *local* para ISO:
    const localMidnight = new Date(2026, 5, 16); // 16-jun 00:00 SP
    const buggyWrite = localMidnight.toISOString().slice(0, 10);
    expect(buggyWrite).toBe("2026-06-15"); // ← aqui está o shift
    // Helper correto:
    expect(formatLocalDate(localMidnight)).toBe("2026-06-16");
  });

  it("em Tóquio, `Date local midnight.toISOString()` adianta um dia", () => {
    if (process.env.TZ !== "Asia/Tokyo") return;
    const localMidnight = new Date(2026, 5, 16); // 16-jun 00:00 JST
    const buggyWrite = localMidnight.toISOString().slice(0, 10);
    expect(buggyWrite).toBe("2026-06-15"); // 15-jun 15:00 UTC
    // Helper correto preserva o dia escolhido pelo usuário:
    expect(formatLocalDate(localMidnight)).toBe("2026-06-16");
  });
});

describe("todayBR / nowSaoPauloISO / getCurrentHourBR — fuso Brasil fixo", () => {
  afterEach(() => vi.useRealTimers());

  it("todayBR retorna 15-jun quando UTC já é 16-jun 02:30 (SP ainda é 23:30 do dia 15)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T02:30:00Z"));
    expect(todayBR()).toBe("2026-06-15");
  });

  it("nowSaoPauloISO devolve wall-time SP com offset -03:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T02:30:00Z"));
    const iso = nowSaoPauloISO();
    expect(iso.startsWith("2026-06-15T23:30:00")).toBe(true);
    expect(iso.endsWith("-03:00")).toBe(true);
  });

  it("getCurrentHourBR ignora fuso do runner (UTC 02:30 → 23h em SP)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T02:30:00Z"));
    expect(getCurrentHourBR()).toBe(23);
  });
});

describe("Sanity de ambiente", () => {
  beforeAll(() => {
    // Em CI, TZ pode estar setada; localmente, não. Imprime para diagnóstico.
    // eslint-disable-next-line no-console
    console.log(`[parseLocalDate.test] TZ runtime = ${process.env.TZ ?? "(host default)"}`);
  });

  it("Intl tem a timezone America/Sao_Paulo disponível (icu)", () => {
    expect(() =>
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo" }).format(new Date()),
    ).not.toThrow();
  });
});
