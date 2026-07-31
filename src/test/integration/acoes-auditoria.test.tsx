/**
 * Auditoria das ações "Enviar para aprovação" e "Chamar atenção".
 * Garante que cada disparo (início, conclusão e falha) grave o evento no
 * histórico da entidade (tarefa, prospect, projeto...).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook, act } from "@testing-library/react";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: any[]) => rpcMock(...a) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { registrarAcaoChat, listarAcoesAuditoria } from "@/lib/chat/acoesAuditoria";
import { useAbrirAcaoVinculada } from "@/hooks/chat/useAbrirAcaoVinculada";

const assign = vi.fn();

beforeEach(() => {
  rpcMock.mockReset();
  assign.mockReset();
  Object.defineProperty(window, "location", {
    value: { assign, href: "http://localhost/" },
    writable: true,
  });
});

const callsTo = (fn: string) => rpcMock.mock.calls.filter((c) => c[0] === fn);

describe("registrarAcaoChat", () => {
  it("grava o evento com ação, fase, entidade e conversa", async () => {
    rpcMock.mockResolvedValue({ data: "audit-1", error: null });
    const id = await registrarAcaoChat({
      acao: "aprovacao",
      fase: "concluida",
      entidadeTipo: "tarefa",
      entidadeId: "t-1",
      conversaId: "c-1",
      referenciaId: "ap-1",
      detalhe: "Aprovar arte final",
    });
    expect(id).toBe("audit-1");
    expect(rpcMock).toHaveBeenCalledWith("rpc_registrar_acao_chat_auditoria", {
      p_acao: "aprovacao",
      p_fase: "concluida",
      p_entidade_tipo: "tarefa",
      p_entidade_id: "t-1",
      p_conversa_id: "c-1",
      p_referencia_id: "ap-1",
      p_detalhe: "Aprovar arte final",
      p_erro: null,
      p_metadata: {},
    });
  });

  it("registra chamada de atenção em prospect com metadata", async () => {
    rpcMock.mockResolvedValue({ data: "audit-2", error: null });
    await registrarAcaoChat({
      acao: "urgente",
      fase: "iniciada",
      entidadeTipo: "prospect",
      entidadeId: "p-9",
      metadata: { origem: "hub" },
    });
    const args = rpcMock.mock.calls[0][1];
    expect(args.p_acao).toBe("urgente");
    expect(args.p_entidade_tipo).toBe("prospect");
    expect(args.p_entidade_id).toBe("p-9");
    expect(args.p_metadata).toEqual({ origem: "hub" });
  });

  it("normaliza o motivo do erro na fase de falha", async () => {
    rpcMock.mockResolvedValue({ data: "audit-3", error: null });
    await registrarAcaoChat({
      acao: "aprovacao",
      fase: "falhou",
      entidadeTipo: "tarefa",
      entidadeId: "t-1",
      erro: { message: "permission denied" },
    });
    expect(rpcMock.mock.calls[0][1].p_erro).toBe("permission denied");
  });

  it("não quebra o fluxo quando o backend recusa o registro", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { message: "rls" } });
    await expect(
      registrarAcaoChat({ acao: "urgente", fase: "concluida", entidadeTipo: "conversa" }),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("listarAcoesAuditoria", () => {
  it("consulta o histórico da entidade", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "a1", acao: "aprovacao", fase: "concluida", user_nome: "Ana" }],
      error: null,
    });
    const rows = await listarAcoesAuditoria("tarefa", "t-1", 50);
    expect(rpcMock).toHaveBeenCalledWith("rpc_chat_acoes_auditoria_historico", {
      p_entidade_tipo: "tarefa",
      p_entidade_id: "t-1",
      p_limit: 50,
    });
    expect(rows[0].user_nome).toBe("Ana");
  });

  it("propaga erro de leitura", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "sem acesso" } });
    await expect(listarAcoesAuditoria("prospect", "p-1")).rejects.toMatchObject({
      message: "sem acesso",
    });
  });
});

describe("useAbrirAcaoVinculada grava a trilha", () => {
  it("registra a fase iniciada da aprovação com a conversa criada", async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "rpc_get_or_create_conversa_vinculada"
          ? { data: "conv-1", error: null }
          : { data: "audit-1", error: null },
      ),
    );
    const { result } = renderHook(() => useAbrirAcaoVinculada());
    await act(async () => {
      await result.current.abrirAprovacao({ tipo: "tarefa", refId: "t-1", titulo: "Tarefa X" });
    });
    const audit = callsTo("rpc_registrar_acao_chat_auditoria");
    expect(audit).toHaveLength(1);
    expect(audit[0][1]).toMatchObject({
      p_acao: "aprovacao",
      p_fase: "iniciada",
      p_entidade_tipo: "tarefa",
      p_entidade_id: "t-1",
      p_conversa_id: "conv-1",
      p_detalhe: "Tarefa X",
    });
  });

  it("registra a fase iniciada da chamada de atenção", async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "rpc_get_or_create_conversa_vinculada"
          ? { data: "conv-2", error: null }
          : { data: "audit-2", error: null },
      ),
    );
    const { result } = renderHook(() => useAbrirAcaoVinculada());
    await act(async () => {
      await result.current.abrirUrgente({ tipo: "projeto", refId: "pr-1", titulo: "Projeto Y" });
    });
    expect(callsTo("rpc_registrar_acao_chat_auditoria")[0][1]).toMatchObject({
      p_acao: "urgente",
      p_fase: "iniciada",
      p_entidade_tipo: "projeto",
      p_entidade_id: "pr-1",
      p_conversa_id: "conv-2",
    });
  });

  it("registra a falha quando o backend nega a ação", async () => {
    rpcMock.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "rpc_get_or_create_conversa_vinculada"
          ? { data: null, error: { message: "permission denied" } }
          : { data: "audit-3", error: null },
      ),
    );
    const { result } = renderHook(() => useAbrirAcaoVinculada());
    await act(async () => {
      await result.current.abrirAprovacao({ tipo: "tarefa", refId: "t-2", titulo: "Tarefa Z" });
    });
    const audit = callsTo("rpc_registrar_acao_chat_auditoria");
    expect(audit).toHaveLength(1);
    expect(audit[0][1]).toMatchObject({
      p_fase: "falhou",
      p_entidade_id: "t-2",
      p_erro: "permission denied",
    });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("adoção da auditoria nos fluxos de envio", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  it("UrgentSendDialog registra conclusão e falha", () => {
    const src = read("src/components/chat/v2/UrgentSendDialog.tsx");
    expect(src).toContain("registrarAcaoChat");
    expect(src).toContain('fase: "concluida"');
    expect(src).toContain('fase: "falhou"');
  });

  it("NovaAprovacaoDialog registra a aprovação criada com a referência", () => {
    const src = read("src/components/chat/v2/NovaAprovacaoDialog.tsx");
    expect(src).toContain("registrarAcaoChat");
    expect(src).toContain("referenciaId: aprovacaoId");
    expect(src).toContain('acao: "aprovacao"');
  });

  it("hook de histórico usa a RPC auditada", () => {
    const src = read("src/hooks/chat/useChatAcoesAuditoria.ts");
    expect(src).toContain("listarAcoesAuditoria");
  });
});
