/**
 * E2E: verifica que o ProjetoMembrosDialog, após uma remoção bem-sucedida,
 * não deixa NENHUM listener residual de `keydown`, `pointerdown`,
 * `pointerup`, `mousedown`, `click`, `touchstart` ou `focusin` no
 * `document`/`window` — nem nenhum overlay portal Radix com handler ativo.
 *
 * Estratégia:
 *  1. Antes de abrir o dialog, monkey-patcha `document.addEventListener` e
 *     `window.addEventListener` para registrar todo handler instalado a
 *     partir desse ponto (snapshot "antes").
 *  2. Faz o mesmo wrap para `removeEventListener`, contabilizando remoções.
 *  3. Abre o dialog → remove membro → aguarda sucesso → fecha.
 *  4. Verifica que, para cada (target, type) instalado durante a vida do
 *     dialog, houve uma remoção correspondente (saldo == 0) para os tipos
 *     sensíveis ao bloqueio: keydown, pointerdown, pointerup, mousedown,
 *     click, touchstart, focusin.
 *  5. Como sonda funcional adicional: dispara eventos sintéticos
 *     (Escape no document; pointerdown em coordenadas livres) e confirma
 *     que `defaultPrevented` é false (ninguém capturando/cancelando).
 *  6. Confirma que não restou portal Radix (`[data-radix-portal]`,
 *     `[data-radix-dialog-overlay]`) montado.
 */

type ListenerKey = string; // `${target}|${type}`
type Counts = Map<ListenerKey, number>;

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

describe("ProjetoMembrosDialog — sem listeners residuais após sucesso", () => {
  const PROJETO_ID = Cypress.env("PROJETO_ID") || "test-projeto-id";
  const MEMBRO_ID = "membro-teste-1";
  const DIALOG = '[data-testid="projeto-membros-dialog"]';

  beforeEach(() => {
    cy.intercept("POST", "**/rest/v1/rpc/remover_membro_projeto*", (req) => {
      req.on("response", (res) => res.setDelay(400));
      req.reply({ statusCode: 200, body: { ok: true } });
    }).as("remover");
  });

  it("instala/remove handlers sensíveis com saldo zero após o sucesso", () => {
    const adicionados: Counts = new Map();
    const removidos: Counts = new Map();

    cy.visit(`/projetos/${PROJETO_ID}`, {
      onBeforeLoad(win) {
        const wrap = (
          obj: EventTarget,
          rotulo: "document" | "window",
        ) => {
          const origAdd = obj.addEventListener.bind(obj);
          const origRem = obj.removeEventListener.bind(obj);
          obj.addEventListener = function (
            type: string,
            listener: any,
            options?: any,
          ) {
            if (TYPES_SENSIVEIS.includes(type)) {
              const k = `${rotulo}|${type}`;
              adicionados.set(k, (adicionados.get(k) ?? 0) + 1);
            }
            return origAdd(type, listener, options);
          } as any;
          obj.removeEventListener = function (
            type: string,
            listener: any,
            options?: any,
          ) {
            if (TYPES_SENSIVEIS.includes(type)) {
              const k = `${rotulo}|${type}`;
              removidos.set(k, (removidos.get(k) ?? 0) + 1);
            }
            return origRem(type, listener, options);
          } as any;
        };
        wrap(win.document, "document");
        wrap(win, "window");
        // Expõe para o teste consultar depois
        (win as any).__listenerSnapshots = { adicionados, removidos };
      },
    });

    // Snapshot de "baseline" (handlers da app antes do dialog)
    cy.window().then((win) => {
      (win as any).__baseline = {
        adicionados: new Map(
          (win as any).__listenerSnapshots.adicionados,
        ) as Counts,
        removidos: new Map(
          (win as any).__listenerSnapshots.removidos,
        ) as Counts,
      };
    });

    // Fluxo: abrir dialog → remover → sucesso → fechar
    cy.get('[data-testid="abrir-membros-dialog"]').click();
    cy.get(DIALOG).should("be.visible");
    cy.get(
      `[data-testid="member-remove-btn"][data-member-id="${MEMBRO_ID}"]`,
    ).click();
    cy.get('[data-testid="confirmar-remocao-btn"]').click();
    cy.wait("@remover");
    cy.get(DIALOG).should("have.attr", "aria-busy", "false");

    // Fecha o dialog (estado normal — Escape liberado após sucesso)
    cy.get("body").type("{esc}");
    cy.get(DIALOG).should("not.exist");

    // Verifica que tudo que o dialog adicionou foi removido
    cy.window().then((win) => {
      const snap = (win as any).__listenerSnapshots as {
        adicionados: Counts;
        removidos: Counts;
      };
      const baseline = (win as any).__baseline as {
        adicionados: Counts;
        removidos: Counts;
      };

      const saldoResidual: Record<string, number> = {};
      const todasChaves = new Set<ListenerKey>([
        ...snap.adicionados.keys(),
        ...snap.removidos.keys(),
      ]);
      todasChaves.forEach((k) => {
        const addDelta =
          (snap.adicionados.get(k) ?? 0) -
          (baseline.adicionados.get(k) ?? 0);
        const remDelta =
          (snap.removidos.get(k) ?? 0) - (baseline.removidos.get(k) ?? 0);
        const saldo = addDelta - remDelta;
        if (saldo !== 0) saldoResidual[k] = saldo;
      });

      // Tolerância: zero listeners residuais para os tipos sensíveis.
      expect(
        saldoResidual,
        `Saldo de listeners sensíveis após sucesso deve ser zero. ` +
          `Residuais: ${JSON.stringify(saldoResidual)}`,
      ).to.deep.eq({});
    });

    // Sonda funcional: eventos sintéticos não são capturados/cancelados
    cy.document().then((doc) => {
      const ev = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(ev);
      expect(ev.defaultPrevented, "Escape sem handler residual").to.eq(false);

      const pd = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 5,
        clientY: 5,
      });
      doc.dispatchEvent(pd);
      expect(
        pd.defaultPrevented,
        "pointerdown sem handler residual",
      ).to.eq(false);
    });

    // Sem portal/overlay Radix residual
    cy.get("[data-radix-portal]").should("not.exist");
    cy.get("[data-radix-dialog-overlay]").should("not.exist");
    cy.get('[data-state="open"][role="dialog"]').should("not.exist");
  });
});
