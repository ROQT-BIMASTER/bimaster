/**
 * Testes das mensagens padronizadas de feedback para
 * "Enviar para aprovação" e "Chamar atenção".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: any[]) => toastSuccess(...a), error: (...a: any[]) => toastError(...a) },
}));

import {
  toastAcaoIniciada,
  toastAcaoFalhou,
  toastAcaoConcluida,
  toastAcaoEnvioFalhou,
  toastAcaoValidacao,
  motivoErro,
  nomeEscopo,
} from "@/lib/chat/acoesFeedback";

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe("mensagens de sucesso", () => {
  it("aprovação iniciada usa título fixo e descreve o escopo", () => {
    toastAcaoIniciada("aprovacao", "tarefa");
    expect(toastSuccess).toHaveBeenCalledWith("Aprovação iniciada", {
      description: "Abrindo o chat vinculado ao tarefa.",
    });
  });

  it("chamada de atenção iniciada usa título fixo", () => {
    toastAcaoIniciada("urgente", "projeto");
    expect(toastSuccess).toHaveBeenCalledWith("Chamada de atenção iniciada", {
      description: "Abrindo o chat vinculado ao projeto.",
    });
  });

  it("concorda em gênero para submissão", () => {
    toastAcaoIniciada("aprovacao", "submissao");
    expect(toastSuccess.mock.calls[0][1].description).toContain("à submissão");
  });

  it("ação concluída de aprovação", () => {
    toastAcaoConcluida("aprovacao");
    expect(toastSuccess).toHaveBeenCalledWith("Aprovação solicitada", expect.any(Object));
  });

  it("ação concluída de chamada de atenção", () => {
    toastAcaoConcluida("urgente");
    expect(toastSuccess).toHaveBeenCalledWith("Chamada de atenção enviada", expect.any(Object));
  });

  it("permite descrição customizada mantendo o título padrão", () => {
    toastAcaoConcluida("aprovacao", "Enviada para a Central de Aprovações.");
    expect(toastSuccess).toHaveBeenCalledWith("Aprovação solicitada", {
      description: "Enviada para a Central de Aprovações.",
    });
  });

  it("nunca usa toast.error em casos de sucesso", () => {
    toastAcaoIniciada("urgente", "processo");
    toastAcaoConcluida("urgente");
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("mensagens de falha", () => {
  it("falha ao iniciar aprovação propaga o motivo do backend", () => {
    toastAcaoFalhou("aprovacao", { message: "permission denied" });
    expect(toastError).toHaveBeenCalledWith("Não foi possível iniciar a aprovação", {
      description: "permission denied",
    });
  });

  it("falha ao iniciar chamada de atenção", () => {
    toastAcaoFalhou("urgente", { message: "sem permissão" });
    expect(toastError).toHaveBeenCalledWith("Não foi possível iniciar a chamada de atenção", {
      description: "sem permissão",
    });
  });

  it("usa mensagem genérica quando o erro não tem descrição", () => {
    toastAcaoFalhou("aprovacao", {});
    expect(toastError.mock.calls[0][1]).toEqual({ description: "Tente novamente em instantes." });
    expect(motivoErro(null)).toBe("Tente novamente em instantes.");
    expect(motivoErro({ message: "   " })).toBe("Tente novamente em instantes.");
  });

  it("falha de envio tem título distinto de falha de abertura", () => {
    toastAcaoEnvioFalhou("aprovacao", { message: "x" });
    toastAcaoEnvioFalhou("urgente", { message: "y" });
    expect(toastError.mock.calls[0][0]).toBe("Não foi possível solicitar a aprovação");
    expect(toastError.mock.calls[1][0]).toBe("Não foi possível enviar a chamada de atenção");
  });

  it("validação usa título de revisão com a orientação na descrição", () => {
    toastAcaoValidacao("aprovacao", "Anexe ao menos um documento.");
    toastAcaoValidacao("urgente", "O motivo precisa ter ao menos 8 caracteres.");
    expect(toastError.mock.calls[0]).toEqual([
      "Revise a solicitação de aprovação",
      { description: "Anexe ao menos um documento." },
    ]);
    expect(toastError.mock.calls[1][0]).toBe("Revise a chamada de atenção");
  });

  it("nunca usa toast.success em casos de falha", () => {
    toastAcaoFalhou("aprovacao", { message: "erro" });
    toastAcaoEnvioFalhou("urgente", { message: "erro" });
    toastAcaoValidacao("aprovacao", "erro");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("todo título de erro começa por 'Não foi possível' ou 'Revise'", () => {
    toastAcaoFalhou("urgente", {});
    toastAcaoEnvioFalhou("aprovacao", {});
    toastAcaoValidacao("urgente", "x");
    for (const call of toastError.mock.calls) {
      expect(String(call[0])).toMatch(/^(Não foi possível|Revise)/);
      expect(String(call[0]).endsWith(".")).toBe(false);
      expect(call[1]).toHaveProperty("description");
    }
  });
});

describe("adoção do padrão nos fluxos", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  const arquivos = [
    "src/hooks/chat/useAbrirAcaoVinculada.ts",
    "src/components/chat/v2/UrgentSendDialog.tsx",
    "src/components/chat/v2/NovaAprovacaoDialog.tsx",
    "src/hooks/chat/useChatAprovacao.ts",
  ];

  it("todos os fluxos importam os helpers padronizados", () => {
    for (const f of arquivos) {
      expect(read(f)).toContain("@/lib/chat/acoesFeedback");
    }
  });

  it("useAbrirAcaoVinculada não monta mais strings próprias de toast", () => {
    const src = read("src/hooks/chat/useAbrirAcaoVinculada.ts");
    expect(src).not.toMatch(/toast\.(success|error)\(/);
    expect(src).toContain('toastAcaoIniciada("aprovacao"');
    expect(src).toContain('toastAcaoFalhou("urgente"');
  });

  it("UrgentSendDialog usa os helpers em sucesso, falha e validação", () => {
    const src = read("src/components/chat/v2/UrgentSendDialog.tsx");
    expect(src).toContain('toastAcaoConcluida("urgente")');
    expect(src).toContain('toastAcaoEnvioFalhou("urgente"');
    expect(src).toContain('toastAcaoValidacao("urgente"');
  });

  it("NovaAprovacaoDialog usa os helpers em sucesso, falha e validação", () => {
    const src = read("src/components/chat/v2/NovaAprovacaoDialog.tsx");
    expect(src).toContain('toastAcaoValidacao("aprovacao"');
    expect(src).toContain('toastAcaoConcluida("aprovacao"');
    expect(src).toContain('toastAcaoEnvioFalhou("aprovacao"');
  });

  it("nomeEscopo cobre todos os tipos vinculáveis", () => {
    for (const t of ["briefing", "projeto", "submissao", "tarefa", "processo", "conversa"] as const) {
      expect(nomeEscopo(t)).toBeTruthy();
    }
  });
});
