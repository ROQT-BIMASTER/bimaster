/**
 * E2E: após um sucesso inicial, abre e fecha o ProjetoMembrosDialog
 * repetidas vezes verificando, a cada ciclo, que:
 *  - o dialog desmonta por completo (sem [role="dialog"], sem portal/overlay
 *    Radix residual);
 *  - <body>/<html> ficam limpos (sem aria-hidden, inert, data-scroll-locked,
 *    pointer-events:none, overflow:hidden);
 *  - o número de portais Radix volta ao baseline (não cresce a cada ciclo);
 *  - o número de listeners "sensíveis" instalados em document/window não
 *    cresce ciclo a ciclo (delta == 0 entre abertura/fechamento).
 *
 * Isso protege contra leaks que só apareceriam em múltiplas aberturas.
 */

type Counts = Map<string, number>;
const TYPES_SENSIVEIS = [
  "keydown",
  "keyup",
  "pointerdown",
  "pointerup",
  "mousedown",
  "click",
  "touchstart",
  "focusin",
];
const CICLOS = 5;
const DIALOG = '[data-testid="projeto-membros-dialog"]';

describe("ProjetoMembrosDialog — limpeza estável em múltiplos ciclos abrir/fechar", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_ID = "membro-teste-1";

  beforeEach(() => {
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      req.on("response", (res) => res.setDelay(300));
      req.reply({ statusCode: 200, body: { ok: true } });
    }).as("remover");
  });

  const assertEstadoLimpo = (rotulo: string) => {
    cy.get(DIALOG).should("not.exist");
    cy.get('[role="dialog"]').should("not.exist");
    cy.get("[data-radix-portal]").should("not.exist");
    cy.get("[data-radix-dialog-overlay]").should("not.exist");
    cy.get('[data-state="open"][role="dialog"]').should("not.exist");

    cy.get("body").then(($b) => {
      const body = $b[0];
      const cs = window.getComputedStyle(body);
      expect(body.hasAttribute("aria-hidden"), `${rotulo} body aria-hidden`).to.eq(
        false,
      );
      expect(body.hasAttribute("inert"), `${rotulo} body inert`).to.eq(false);
      expect(
        body.hasAttribute("data-scroll-locked"),
        `${rotulo} body data-scroll-locked`,
      ).to.eq(false);
      expect(cs.pointerEvents, `${rotulo} body pointer-events`).to.not.eq(
        "none",
      );
      expect(cs.overflow, `${rotulo} body overflow`).to.not.eq("hidden");
    });
    cy.get("html").then(($h) => {
      expect(
        $h[0].hasAttribute("data-scroll-locked"),
        `${rotulo} html data-scroll-locked`,
      ).to.eq(false);
    });
  };

  it("mantém o saldo de listeners e portais constante em N ciclos", () => {
    const adicionados: Counts = new Map();
    const removidos: Counts = new Map();

    cy.visit(`/projetos/${PROJETO_ID}`, {
      onBeforeLoad(win) {
        const wrap = (obj: EventTarget, rotulo: "document" | "window") => {
          const a = obj.addEventListener.bind(obj);
          const r = obj.removeEventListener.bind(obj);
          obj.addEventListener = function (
            t: string,
            l: any,
            o?: any,
          ) {
            if (TYPES_SENSIVEIS.includes(t)) {
              const k = `${rotulo}|${t}`;
              adicionados.set(k, (adicionados.get(k) ?? 0) + 1);
            }
            return a(t, l, o);
          } as any;
          obj.removeEventListener = function (
            t: string,
            l: any,
            o?: any,
          ) {
            if (TYPES_SENSIVEIS.includes(t)) {
              const k = `${rotulo}|${t}`;
              removidos.set(k, (removidos.get(k) ?? 0) + 1);
            }
            return r(t, l, o);
          } as any;
        };
        wrap(win.document, "document");
        wrap(win, "window");
        (win as any).__snap = { adicionados, removidos };
      },
    });

    // Sucesso inicial (consome o único membro alvo para os ciclos seguintes
    // exercitarem só abrir/fechar).
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible");
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();
    cy.wait("@remover");
    cy.get(DIALOG).should("have.attr", "aria-busy", "false");
    cy.get("body").type("{esc}");
    assertEstadoLimpo("pós-sucesso inicial");

    // Baseline pós-sucesso
    cy.window().then((win) => {
      const snap = (win as any).__snap as {
        adicionados: Counts;
        removidos: Counts;
      };
      (win as any).__baseline = {
        add: new Map(snap.adicionados),
        rem: new Map(snap.removidos),
      };
    });

    // N ciclos abrir/fechar
    for (let i = 1; i <= CICLOS; i += 1) {
      cy.get('[data-testid="abrir-membros-dialog"]').click();
      cy.get(DIALOG).should("be.visible");

      // Fecha com Escape (livre após sucesso anterior)
      cy.get("body").type("{esc}");
      assertEstadoLimpo(`ciclo ${i} pós-Esc`);

      // Reabre e fecha clicando no [data-testid="close-dialog"]
      cy.get('[data-testid="abrir-membros-dialog"]').click();
      cy.get(DIALOG).should("be.visible");
      cy.get(DIALOG).find('[data-testid="close-dialog"]').click();
      assertEstadoLimpo(`ciclo ${i} pós-close-btn`);
    }

    // Saldo de listeners sensíveis deve ser zero (add - rem == baseline)
    cy.window().then((win) => {
      const snap = (win as any).__snap as {
        adicionados: Counts;
        removidos: Counts;
      };
      const base = (win as any).__baseline as {
        add: Counts;
        rem: Counts;
      };
      const residual: Record<string, number> = {};
      const chaves = new Set<string>([
        ...snap.adicionados.keys(),
        ...snap.removidos.keys(),
      ]);
      chaves.forEach((k) => {
        const addDelta =
          (snap.adicionados.get(k) ?? 0) - (base.add.get(k) ?? 0);
        const remDelta =
          (snap.removidos.get(k) ?? 0) - (base.rem.get(k) ?? 0);
        const saldo = addDelta - remDelta;
        if (saldo !== 0) residual[k] = saldo;
      });
      expect(
        residual,
        `Sem leak de listeners após ${CICLOS} ciclos. Residuais: ${JSON.stringify(residual)}`,
      ).to.deep.eq({});
    });

    // Nenhum portal Radix sobrevivente
    cy.get("[data-radix-portal]").should("not.exist");
    cy.get("[data-radix-dialog-overlay]").should("not.exist");
  });
});
