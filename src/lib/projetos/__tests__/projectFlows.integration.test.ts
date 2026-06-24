/**
 * Integração — roteamento dos dois fluxos pelo ProjectService:
 *  - Fluxo 1 (Ficha do Produto / `useCriarProjetoChina`): a idempotência
 *    pré-check usa `ProjectService.findBySubmission` antes do RPC legado.
 *  - Fluxo 2 (Mesa China / `useCriarProjetoEspelho`): roteia 100% via
 *    `ProjectService.createFromSubmission` / `linkExisting`, com a mesma
 *    forma de `ProjectCreateOpts` em ambos os caminhos.
 *
 * Não toca em produção: tudo mockado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock global do client compartilhado por ProjectService e hooks
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
    supabase: { from: vi.fn(() => fromBuilder), rpc },
    __mocks: { fromBuilder, maybeSingle, rpc },
  };
});

import { useCriarProjetoEspelho } from "@/hooks/useProjetoEspelhoSubmissao";
import { ProjectService } from "@/lib/projetos/projectService";
import * as client from "@/integrations/supabase/client";

const mocks = (
  client as unknown as {
    __mocks: {
      maybeSingle: ReturnType<typeof vi.fn>;
      rpc: ReturnType<typeof vi.fn>;
    };
  }
).__mocks;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("Integração — roteamento Fluxo 1 e Fluxo 2 via ProjectService", () => {
  beforeEach(() => {
    mocks.maybeSingle.mockReset();
    mocks.rpc.mockReset();
  });

  // ---------- Fluxo 1 ----------
  describe("Fluxo 1 (Ficha do Produto) — idempotência via findBySubmission", () => {
    it("retorna o vínculo existente sem disparar create quando há projeto-espelho", async () => {
      mocks.maybeSingle.mockResolvedValueOnce({
        data: { projeto_id: "p-existente", submissao_id: "s-1", is_espelho: true },
        error: null,
      });
      const link = await ProjectService.findBySubmission("s-1");
      expect(link).toEqual({
        projeto_id: "p-existente",
        submissao_id: "s-1",
        is_espelho: true,
      });
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("cai para qualquer vínculo legado (is_espelho=false) antes de criar duplicata", async () => {
      mocks.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { projeto_id: "p-legado", submissao_id: "s-2", is_espelho: false },
          error: null,
        });
      const link = await ProjectService.findBySubmission("s-2");
      expect(link?.projeto_id).toBe("p-legado");
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
  });

  // ---------- Fluxo 2 ----------
  describe("Fluxo 2 (Mesa China / useCriarProjetoEspelho) — opts unificados", () => {
    it("criar (sem projetoId) → ProjectService.createFromSubmission com p_projeto_id=null", async () => {
      mocks.rpc.mockResolvedValueOnce({
        data: {
          projeto_id: "p-novo",
          submissao_id: "s-3",
          created: true,
          already_existed: false,
        },
        error: null,
      });

      const { result } = renderHook(() => useCriarProjetoEspelho(), { wrapper });
      await result.current.mutateAsync({
        submissaoId: "s-3",
        projetoNome: "Compact powder",
        templateB2cId: "tpl-1",
        dataInicio: "2026-06-24",
        prazoPadraoTarefa: 5,
        regimeCalendario: "dias_uteis",
        usaFeriados: true,
      });

      await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
      expect(mocks.rpc).toHaveBeenCalledWith(
        "rpc_china_criar_projeto_espelho",
        expect.objectContaining({
          p_submissao_id: "s-3",
          p_projeto_id: null,
          p_projeto_nome: "Compact powder",
          p_template_b2c_id: "tpl-1",
          p_data_inicio: "2026-06-24",
          p_prazo_padrao_tarefa: 5,
          p_regime_calendario: "dias_uteis",
          p_usa_feriados: true,
          p_secao_nome: "Documentos da Submissão",
          p_substituir: false,
        }),
      );
    });

    it("linkExisting (com projetoId) → ProjectService.linkExisting com p_projeto_id preenchido", async () => {
      mocks.rpc.mockResolvedValueOnce({
        data: {
          projeto_id: "p-existente",
          submissao_id: "s-4",
          created: false,
          already_existed: true,
        },
        error: null,
      });

      const { result } = renderHook(() => useCriarProjetoEspelho(), { wrapper });
      const res = await result.current.mutateAsync({
        submissaoId: "s-4",
        projetoId: "p-existente",
        substituir: true,
      });

      expect(res.already_existed).toBe(true);
      expect(mocks.rpc).toHaveBeenCalledWith(
        "rpc_china_criar_projeto_espelho",
        expect.objectContaining({
          p_submissao_id: "s-4",
          p_projeto_id: "p-existente",
          p_substituir: true,
          p_secao_nome: "Documentos da Submissão",
        }),
      );
    });

    it("defaults: opts vazios produzem exatamente os mesmos parâmetros para create e linkExisting (exceto p_projeto_id)", async () => {
      mocks.rpc.mockResolvedValue({
        data: { projeto_id: "p", submissao_id: "s", created: true, already_existed: false },
        error: null,
      });

      await ProjectService.createFromSubmission("s-A");
      await ProjectService.linkExisting("s-A", "p-A");

      const [, createParams] = mocks.rpc.mock.calls[0];
      const [, linkParams] = mocks.rpc.mock.calls[1];

      // Mesma forma de parâmetros — única diferença é p_projeto_id.
      expect(Object.keys(createParams).sort()).toEqual(Object.keys(linkParams).sort());
      expect(createParams.p_projeto_id).toBeNull();
      expect(linkParams.p_projeto_id).toBe("p-A");

      const { p_projeto_id: _a, ...createRest } = createParams;
      const { p_projeto_id: _b, ...linkRest } = linkParams;
      expect(createRest).toEqual(linkRest);
    });
  });
});
