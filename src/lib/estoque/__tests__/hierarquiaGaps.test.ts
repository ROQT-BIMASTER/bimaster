import { describe, it, expect } from "vitest";
import { classificarGaps, temAlgumGap, type GapTreeNode, type GapSkuNode } from "../hierarquiaGaps";

const mk = (
  cod: number,
  nivel: number,
  saldo: number,
  disp: number,
  nome = `P${cod}`,
  children: GapTreeNode[] = [],
): GapTreeNode => ({
  sku: { cod_produto: cod, nivel, saldo, disponivel: disp, nome_prod: nome } as GapSkuNode,
  children,
});

describe("classificarGaps", () => {
  it("CX com saldo, BX zerado → faltantesBX = 1", () => {
    const tree = [mk(1, 1, 10, 10, "CX", [mk(2, 2, 0, 0, "BX")])];
    const r = classificarGaps(tree);
    expect(r.faltantesBX).toBe(1);
    expect(r.statusByCodigo.get(2)).toBe("faltante");
    expect(temAlgumGap(r)).toBe(true);
  });

  it("BX com saldo, 3 UN, 2 zeradas → faltantesUN=2 e lista cores", () => {
    const tree = [
      mk(1, 1, 5, 5, "CX", [
        mk(2, 2, 3, 3, "BX-Mix", [
          mk(3, 3, 0, 0, "Cor A"),
          mk(4, 3, 7, 7, "Cor B"),
          mk(5, 3, 0, 0, "Cor C"),
        ]),
      ]),
    ];
    const r = classificarGaps(tree);
    expect(r.faltantesUN).toBe(2);
    expect(r.coresFaltantes.map((c) => c.nome).sort()).toEqual(["Cor A", "Cor C"]);
    expect(r.coresFaltantes[0].paiBX).toBe("BX-Mix");
  });

  it("CX com saldo sem filhos → sem_filhos_mapeados", () => {
    const tree = [mk(1, 1, 5, 5, "CX")];
    const r = classificarGaps(tree);
    expect(r.semFilhosMapeados).toBe(1);
    expect(r.statusByCodigo.get(1)).toBe("sem_filhos_mapeados");
  });

  it("árvore totalmente OK → nenhum gap", () => {
    const tree = [
      mk(1, 1, 10, 10, "CX", [
        mk(2, 2, 5, 5, "BX", [mk(3, 3, 50, 50, "UN")]),
      ]),
    ];
    const r = classificarGaps(tree);
    expect(temAlgumGap(r)).toBe(false);
  });



  it("cenário real (7494→7496→7498): UN incluído pelo complemento vira faltante", () => {
    // Reproduz o caso do print: BX com saldo, UN filho com saldo 0
    // (oriundo do complemento BOM). Deve ser classificado como faltante,
    // não como "sem_filhos_mapeados" no pai.
    const tree = [
      mk(7494, 1, 39, 39, "CX RUBYROSE", [
        mk(7496, 2, 56, 56, "BX JOY", [mk(7498, 3, 0, 0, "UN JOY")]),
        mk(7501, 2, 56, 56, "BX JEALOUSY", [mk(7503, 3, 0, 0, "UN JEALOUSY")]),
      ]),
    ];
    const r = classificarGaps(tree);
    expect(r.semFilhosMapeados).toBe(0);
    expect(r.faltantesUN).toBe(2);
    expect(r.statusByCodigo.get(7496)).toBe("ok");
    expect(r.statusByCodigo.get(7498)).toBe("faltante");
  });

  it("cenário 10043→4211→3413: complemento BOM trazendo saldo real → sem gaps", () => {
    // Antes do fix, 4211 e 3413 eram excluídos do complemento porque tinham
    // estoque na empresa (sob raiz própria), e 10043 aparecia como
    // "sem_filhos_mapeados". Agora o complemento traz o saldo real, e a árvore
    // não deve reportar gap algum.
    const tree = [
      mk(10043, 1, 11, 11, "CX BLUSH BATOM SOMBRA", [
        mk(4211, 2, 3, 3, "BX BLUSH BATOM SOMBRA", [
          mk(3413, 3, 880, 878, "UN BLUSH BATOM SOMBRA"),
        ]),
      ]),
    ];
    const r = classificarGaps(tree);
    expect(r.semFilhosMapeados).toBe(0);
    expect(r.faltantesBX).toBe(0);
    expect(r.faltantesUN).toBe(0);
    expect(temAlgumGap(r)).toBe(false);
  });

  it("cenário 2324→{2325→2331,...}: CX raiz sem saldo na filial ainda ancora árvore", () => {
    // Caso real (raiz 2324 empresa 11): a CX não existe no estoque dessa
    // filial. Após o fix na função de complemento, a raiz é emitida com
    // saldo=0, e todos os BX/UN filhos aparecem corretamente — nada cai como
    // órfão.
    const tree = [
      mk(2324, 1, 0, 0, "CX BATOM LIQUIDO MOOD RUBYROSE", [
        mk(2325, 2, 109, 107, "BX DESIRE", [mk(2331, 3, 625, 625, "UN DESIRE")]),
        mk(2332, 2, 169, 164, "BX SATISFACTION", [mk(2333, 3, 228, 228, "UN SATISFACTION")]),
      ]),
    ];
    const r = classificarGaps(tree);
    // 2324 tem saldo 0 (CX sem físico nessa filial) e tem filhos mapeados →
    // não deve ser marcado como sem_filhos_mapeados nem como faltante (pai
    // sem saldo).
    expect(r.semFilhosMapeados).toBe(0);
    expect(r.faltantesCX).toBe(0);
    expect(r.faltantesBX).toBe(0);
    expect(r.faltantesUN).toBe(0);
    expect(temAlgumGap(r)).toBe(false);
  });

  it("usar=saldo respeita escolha", () => {
    const tree = [mk(1, 1, 10, 10, "CX", [mk(2, 2, 5, 0, "BX")])];
    expect(classificarGaps(tree, { usar: "disponivel" }).faltantesBX).toBe(1);
    expect(classificarGaps(tree, { usar: "saldo" }).faltantesBX).toBe(0);
  });
});
