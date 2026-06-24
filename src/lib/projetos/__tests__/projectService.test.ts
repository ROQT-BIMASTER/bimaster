import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do cliente Supabase ANTES de importar o serviço
vi.mock("@/integrations/supabase/client", () => {
  const maybeSingle = vi.fn();
  const rpc = vi.fn();

  const fromBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle,
  };

  return {
    supabase: {
      from: vi.fn(() => fromBuilder),
      rpc,
    },
    __mocks: { fromBuilder, maybeSingle, rpc },
  };
});

import { ProjectService } from "../projectService";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as client from "@/integrations/supabase/client";

const mocks = (client as unknown as { __mocks: {
  fromBuilder: { maybeSingle: ReturnType<typeof vi.fn> };
  maybeSingle: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
} }).__mocks;

describe("ProjectService — unificação Submissão↔Projeto (Fase 7)", () => {
  beforeEach(() => {
    mocks.maybeSingle.mockReset();
    mocks.rpc.mockReset();
  });

  it("findBySubmission retorna null para id vazio (não consulta o banco)", async () => {
    const result = await ProjectService.findBySubmission("");
    expect(result).toBeNull();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it("findBySubmission prefere o vínculo is_espelho=true", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { projeto_id: "p-espelho", submissao_id: "s-1", is_espelho: true },
      error: null,
    });
    const link = await ProjectService.findBySubmission("s-1");
    expect(link?.projeto_id).toBe("p-espelho");
    expect(link?.is_espelho).toBe(true);
  });

  it("findBySubmission cai para qualquer vínculo se não houver espelho", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { projeto_id: "p-legado", submissao_id: "s-2", is_espelho: false },
        error: null,
      });
    const link = await ProjectService.findBySubmission("s-2");
    expect(link?.projeto_id).toBe("p-legado");
  });

  it("createFromSubmission exige submissaoId", async () => {
    await expect(ProjectService.createFromSubmission("")).rejects.toThrow(
      /submissaoId/,
    );
  });

  it("createFromSubmission delega para rpc_china_criar_projeto_espelho", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        projeto_id: "p-novo",
        submissao_id: "s-3",
        created: true,
        already_existed: false,
      },
      error: null,
    });
    const result = await ProjectService.createFromSubmission("s-3", {
      projetoNome: "Teste",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "rpc_china_criar_projeto_espelho",
      expect.objectContaining({
        p_submissao_id: "s-3",
        p_projeto_nome: "Teste",
        p_substituir: false,
      }),
    );
    expect(result.projeto_id).toBe("p-novo");
  });

  it("linkExisting passa p_projeto_id e nunca substitui", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { projeto_id: "p-existente", submissao_id: "s-4", already_existed: true },
      error: null,
    });
    await ProjectService.linkExisting("s-4", "p-existente");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "rpc_china_criar_projeto_espelho",
      expect.objectContaining({
        p_submissao_id: "s-4",
        p_projeto_id: "p-existente",
        p_substituir: false,
      }),
    );
  });

  it("propaga erro do RPC sem mascarar", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    await expect(
      ProjectService.createFromSubmission("s-5"),
    ).rejects.toMatchObject({ message: "permission denied" });
  });
});
