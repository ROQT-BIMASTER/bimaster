import { describe, expect, it } from "vitest";
import { eventoToCalendarEvent } from "@/components/calendario/types";
import type { CalendarioEvento } from "@/hooks/useCalendarioEventos";

const base: CalendarioEvento = {
  id: "evt-1",
  titulo: "Reunião de planejamento",
  descricao: "Pauta trimestral",
  data_inicio: "2026-08-10",
  data_fim: "2026-08-10",
  dia_inteiro: false,
  hora_inicio: "09:00:00",
  hora_fim: "10:30:00",
  local: "Sala 2",
  cor: "#0ea5e9",
  categoria: "reuniao",
  visibilidade: "compartilhado",
  criado_por: "user-1",
  recorrencia_id: null,
  participantes: ["user-2"],
  tags: [],
};

describe("eventoToCalendarEvent", () => {
  it("mapeia campos do evento avulso para o modelo unificado", () => {
    const ev = eventoToCalendarEvent(base);
    expect(ev.tipo).toBe("evento");
    expect(ev.origem).toBe("calendario");
    expect(ev.data_inicio).toBe("2026-08-10");
    expect(ev.data_prazo).toBe("2026-08-10");
    expect(ev.hora_inicio).toBe("09:00");
    expect(ev.hora_fim).toBe("10:30");
    expect(ev.cor).toBe("#0ea5e9");
    expect(ev.local).toBe("Sala 2");
  });

  it("omite horários quando o evento é de dia inteiro", () => {
    const ev = eventoToCalendarEvent({ ...base, dia_inteiro: true });
    expect(ev.hora_inicio).toBeNull();
    expect(ev.hora_fim).toBeNull();
  });
});
