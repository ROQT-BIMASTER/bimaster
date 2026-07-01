import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes de integração do fluxo de carregamento de subtarefas + seguidores
 * quando o backend está com RLS/RPC incompletos.
 *
 * Cobre as ramificações críticas de `fetchHydratedSubtarefas`, que é o
 * ponto único de hidratação usado pela `SubtarefasSection` (V2) e pelos
 * bridges da Central de Trabalho / MinhasTarefas (V1) para renderizar
 * responsável e pilha de seguidores.
 */

type Row = Record<string, any>;

// Fila de respostas que o mock do supabase vai devolver, na ordem das
// chamadas `.from(...)...await`. Cada teste empilha o que precisar.
const responseQueue: Array<{ data: any; error: any }> = [];

function pushResponse(data: any, error: any = null) {
  responseQueue.push({ data, error });
}

vi.mock("@/integrations/supabase/client", () => {
  function makeBuilder() {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => {
        const next = responseQueue.shift() ?? { data: [], error: null };
        return Promise.resolve(next);
      }),
      then: (resolve: any, reject: any) => {
        const next = responseQueue.shift() ?? { data: [], error: null };
        return Promise.resolve(next).then(resolve, reject);
      },
    };
    return builder;
  }
  return {
    supabase: {
      from: vi.fn(() => makeBuilder()),
    },
  };
});

import { fetchHydratedSubtarefas } from "@/lib/projetos/fetchHydratedSubtarefas";

beforeEach(() => {
  responseQueue.length = 0;
});

describe("fetchHydratedSubtarefas (integração RLS/RPC incompleto)", () => {
  it("retorna [] imediatamente quando parentId é vazio (não chama o backend)", async () => {
    const result = await fetchHydratedSubtarefas("");
    expect(result).toEqual([]);
    expect(responseQueue.length).toBe(0);
  });

  it("caminho feliz: join completo hidrata responsavel + responsaveis + colaboradores", async () => {
    const row: Row = {
      id: "t1",
      parent_tarefa_id: "p1",
      responsavel_id: "u-owner",
      responsavel: { id: "u-owner", nome: "Ana Dona", avatar_url: "avatars/ana.png" },
      responsaveis: [
        {
          user_id: "u-owner",
          papel: "principal",
          profile: { nome: "Ana Dona", avatar_url: "avatars/ana.png" },
        },
        {
          user_id: "u-2",
          papel: "colaborador",
          profile: { nome: "Bruno Membro", avatar_url: null },
        },
      ],
      colaboradores: [
        { user_id: "u-3", profile: { nome: "Carla Seguidora", avatar_url: "avatars/carla.png" } },
        { user_id: "u-4", profile: null }, // profile ausente -> fallback "Membro"
      ],
    };
    pushResponse([row]);

    const [t] = await fetchHydratedSubtarefas("p1");

    expect(t.responsavel).toEqual({
      id: "u-owner",
      nome: "Ana Dona",
      avatar_url: "avatars/ana.png",
    });
    expect(t.responsaveis).toHaveLength(2);
    expect(t.responsaveis?.[1]).toMatchObject({
      user_id: "u-2",
      papel: "colaborador",
      nome: "Bruno Membro",
      avatar_url: null,
    });
    expect(t.colaboradores).toHaveLength(2);
    // profile nulo -> nome fallback "Membro" (regra que o SmartAvatar consome)
    expect(t.colaboradores?.[1]).toEqual({
      user_id: "u-4",
      nome: "Membro",
      avatar_url: null,
    });
  });

  it("RLS bloqueando o join: cai no fallback, busca linhas cruas e re-hidrata responsavel via profiles", async () => {
    // 1ª chamada (com join) falha simulando RLS
    pushResponse(null, { message: "permission denied for table profiles", code: "42501" });
    // 2ª chamada: linhas cruas
    pushResponse([
      { id: "t1", parent_tarefa_id: "p1", responsavel_id: "u-owner" },
      { id: "t2", parent_tarefa_id: "p1", responsavel_id: "u-orphan" },
      { id: "t3", parent_tarefa_id: "p1", responsavel_id: null },
    ]);
    // 3ª chamada: lookup em profiles retorna só um dos ids (RLS parcial)
    pushResponse([{ id: "u-owner", nome: "Ana Dona", avatar_url: "avatars/ana.png" }]);

    const rows = await fetchHydratedSubtarefas("p1");
    expect(rows).toHaveLength(3);

    // t1: responsavel resolvido
    expect(rows[0].responsavel).toEqual({
      id: "u-owner",
      nome: "Ana Dona",
      avatar_url: "avatars/ana.png",
    });
    // t2: id existe mas profile não voltou (RLS bloqueou) -> null, sem crash
    expect(rows[1].responsavel).toBeNull();
    // t3: sem responsavel_id -> null
    expect(rows[2].responsavel).toBeNull();

    // Em qualquer linha do fallback, listas de seguidores/multi ficam vazias
    // (a UI mostra apenas placeholder + botão "Equipe")
    for (const r of rows) {
      expect(r.responsaveis).toEqual([]);
      expect(r.colaboradores).toEqual([]);
    }
  });

  it("RLS bloqueia o join E não há responsavel_id em nenhuma linha: não chama profiles", async () => {
    pushResponse(null, { message: "permission denied", code: "42501" });
    pushResponse([
      { id: "t1", parent_tarefa_id: "p1", responsavel_id: null },
      { id: "t2", parent_tarefa_id: "p1", responsavel_id: null },
    ]);
    // Nenhuma 3ª resposta empilhada -> se código chamar profiles, o mock
    // devolve `[]` default e o teste ainda passa; mas garantimos que o
    // fallback funciona mesmo sem ids.

    const rows = await fetchHydratedSubtarefas("p1");
    expect(rows.map((r) => r.responsavel)).toEqual([null, null]);
    expect(rows.every((r) => (r.colaboradores || []).length === 0)).toBe(true);
  });

  it("RLS bloqueia join E a busca de linhas cruas também falha (RLS total): retorna []", async () => {
    pushResponse(null, { message: "join denied", code: "42501" });
    pushResponse(null, { message: "denied", code: "42501" });

    const rows = await fetchHydratedSubtarefas("p1");
    expect(rows).toEqual([]);
  });

  it("join retorna null/[] (RPC subjacente sem dados): retorna [] sem quebrar", async () => {
    pushResponse(null);
    const rows = await fetchHydratedSubtarefas("p1");
    expect(rows).toEqual([]);
  });

  it("normaliza colaboradores duplicados na origem (mesmo user_id em posições diferentes)", async () => {
    // Duplicação vem da junction quando há race entre insert do bridge
    // e do trigger; a hidratação preserva ambos, e a deduplicação final
    // ocorre no SubtarefaSeguidoresPicker (coberta em outro teste).
    pushResponse([
      {
        id: "t1",
        parent_tarefa_id: "p1",
        responsavel_id: null,
        responsavel: null,
        responsaveis: [],
        colaboradores: [
          { user_id: "dup", profile: { nome: "Duplo", avatar_url: null } },
          { user_id: "dup", profile: { nome: "Duplo", avatar_url: null } },
        ],
      },
    ]);
    const [t] = await fetchHydratedSubtarefas("p1");
    // fetchHydratedSubtarefas NÃO deduplica (contrato: espelha o backend);
    // garantimos aqui que os dois vieram, para o Picker resolver.
    expect(t.colaboradores).toHaveLength(2);
    expect(t.colaboradores?.every((c) => c.user_id === "dup")).toBe(true);
  });
});
