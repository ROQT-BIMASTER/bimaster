import { describe, expect, it } from "vitest";
import { lancamentoSchema, mensalistaSchema, reservaSchema } from "@/lib/validations/quadra";

describe("lancamentoSchema", () => {
  const base = {
    tipo: "despesa",
    categoria: "energia",
    descricao: "Conta de luz",
    valor: 250.5,
    data_competencia: "2026-10-01",
    data_vencimento: "2026-10-10",
    data_pagamento: "",
    status: "pendente",
    forma_pagamento: "",
    observacoes: "",
  };

  it("normaliza campos vazios para null", () => {
    const out = lancamentoSchema.parse(base);
    expect(out.data_pagamento).toBeNull();
    expect(out.forma_pagamento).toBeNull();
    expect(out.observacoes).toBeNull();
  });

  it("exige data de pagamento quando status é pago", () => {
    const r = lancamentoSchema.safeParse({ ...base, status: "pago" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join(".") === "data_pagamento")).toBe(true);
    expect(lancamentoSchema.safeParse({ ...base, status: "pago", data_pagamento: "2026-10-09" }).success).toBe(true);
  });

  it("rejeita valor zero e campos desconhecidos (strict)", () => {
    expect(lancamentoSchema.safeParse({ ...base, valor: 0 }).success).toBe(false);
    expect(lancamentoSchema.safeParse({ ...base, reserva_id: "x" }).success).toBe(false);
  });
});

describe("reservaSchema", () => {
  const base = {
    data: "2026-10-30",
    horario_inicio: "19:00",
    horario_fim: "20:00",
    cliente_nome: "Time da firma",
    cliente_telefone: "",
    mensalista_id: "",
    valor: 180,
    status: "confirmada",
    status_pagamento: "pendente",
    forma_pagamento: "",
    observacoes: "",
  };

  it("aceita reserva válida e converte opcionais vazios em null", () => {
    const out = reservaSchema.parse(base);
    expect(out.mensalista_id).toBeNull();
    expect(out.cliente_telefone).toBeNull();
  });

  it("rejeita horário final menor ou igual ao inicial", () => {
    expect(reservaSchema.safeParse({ ...base, horario_fim: "19:00" }).success).toBe(false);
    expect(reservaSchema.safeParse({ ...base, horario_fim: "18:00" }).success).toBe(false);
  });
});

describe("mensalistaSchema", () => {
  const base = {
    nome: "Pelada de quarta",
    telefone: "",
    email: "",
    dia_semana: 3,
    horario_inicio: "20:00",
    horario_fim: "21:30",
    valor_mensal: 600,
    dia_vencimento: 10,
    ativo: true,
    observacoes: "",
  };

  it("aceita cadastro válido", () => {
    expect(mensalistaSchema.safeParse(base).success).toBe(true);
  });

  it("limita o dia de vencimento a 28 e valida e-mail", () => {
    expect(mensalistaSchema.safeParse({ ...base, dia_vencimento: 31 }).success).toBe(false);
    expect(mensalistaSchema.safeParse({ ...base, email: "nao-e-email" }).success).toBe(false);
    expect(mensalistaSchema.safeParse({ ...base, email: "time@exemplo.com" }).success).toBe(true);
  });
});
