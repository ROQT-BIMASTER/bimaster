/// <reference types="cypress" />

/**
 * E2E (Cypress) — aria-live: contagem exata de anúncios.
 *
 * Garante, observando mutações reais do DOM da live region, que:
 *  - "Removendo {nome}…" é gravado EXATAMENTE 1 vez por tentativa (nem 0, nem 2).
 *  - Cada tentativa produz uma combinação única de (attempt, snapshot) — não há
 *    duplicação dentro da mesma tentativa.
 *  - Após "Tentar novamente", os snapshots antigos não voltam a aparecer
 *    (o nó é recriado via `key`, então cada anúncio é discreto, não cumulativo).
 *  - Sequência final esperada (para N=3): 3 "Removendo …" + 1 "sucesso",
 *    em ordem estrita, sem strings residuais entre tentativas.
 *
 * Vars: CYPRESS_TEST_EMAIL/PASSWORD, CYPRESS_PROJETO_ID.
 */
const PROJETO_ID = Cypress.env("PROJETO_ID") as string | undefined;
const FAIL_COUNT = 2; // 2 falhas + 1 sucesso = 3 anúncios "Removendo …"

interface Announcement {
  attempt: string | null;
  text: string;
  at: number;
}

describe("Membros do Projeto — aria-live: 1 anúncio por tentativa, sem repetição", () => {
  beforeEach(function () {
    if (!PROJETO_ID) this.skip();
    cy.login();
    cy.visit(`/dashboard/projetos/${PROJETO_ID}`);
    cy.contains("button", /membros|equipe/i).first().click();
    cy.findByRole("dialog", { name: /membros do projeto/i }).should("be.visible");
  });

  it("captura todas as mutações da live region e valida contagem exata", () => {
    let calls = 0;
    cy.intercept({ method: "DELETE", url: /projeto_membros/i }, (req) => {
      calls++;
      if (calls <= FAIL_COUNT) {
        req.reply({
          statusCode: 500,
          body: { message: "Falha simulada", code: "ERR_X" },
        });
      } else {
        req.on("response", (res) => res.setDelay(800));
      }
    }).as("removeMembro");

    // Captura o nome do membro a remover (vem do título do AlertDialog).
    cy.get('[data-testid="member-remove-btn"]').first().click();
    cy.findByRole("alertdialog").as("alert");

    // Plugar MutationObserver na live region — coleta cada snapshot textual.
    cy.window().then((win) => {
      (win as any).__announcements = [] as Announcement[];
      const node = win.document.querySelector('[data-testid="membros-live-region"]');
      if (!node) throw new Error("Live region não encontrada");
      // Snapshot inicial (vazio é normal).
      const push = (el: Element) => {
        const text = (el.textContent || "").trim();
        if (!text) return;
        (win as any).__announcements.push({
          attempt: el.getAttribute("data-attempt"),
          text,
          at: Date.now(),
        });
      };
      push(node);
      // Observa o container pai porque o `key` força recriação do nó.
      const parent = node.parentElement ?? node;
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          // Quando o nó é recriado (childList), captura o novo nó.
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) {
              const liveEl = n.matches('[data-testid="membros-live-region"]')
                ? n
                : n.querySelector?.('[data-testid="membros-live-region"]');
              if (liveEl) push(liveEl as Element);
            }
          });
          // Quando só o texto muda (mesmo nó).
          if (m.type === "characterData" || m.type === "childList") {
            const liveEl = win.document.querySelector('[data-testid="membros-live-region"]');
            if (liveEl) push(liveEl);
          }
        }
      });
      observer.observe(parent, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      (win as any).__liveObserver = observer;
    });

    // 1ª tentativa (falha).
    cy.get("@alert").contains("button", /^remover$/i).click();
    cy.findByTestId("remove-error").should("have.attr", "data-attempt", "1");

    // 2ª tentativa (falha) — testa especificamente a não-repetição.
    cy.get("@alert").contains("button", /tentar novamente/i).click();
    cy.findByTestId("remove-error").should("have.attr", "data-attempt", "2");

    // 3ª tentativa (sucesso).
    cy.get("@alert").contains("button", /tentar novamente/i).click();
    cy.get("@alert").should("not.exist");

    // Validações sobre o histórico capturado.
    cy.window().then((win) => {
      const obs = (win as any).__liveObserver as MutationObserver | undefined;
      obs?.disconnect();
      const all = ((win as any).__announcements as Announcement[]).filter((a) => a.text.length > 0);

      // Dedup contíguo (MutationObserver pode disparar várias mutações por
      // mudança visual; o que importa é o STRING único por tentativa).
      const dedup: Announcement[] = [];
      for (const a of all) {
        const last = dedup[dedup.length - 1];
        if (!last || last.text !== a.text || last.attempt !== a.attempt) dedup.push(a);
      }

      const loading = dedup.filter((a) => /^Removendo .+…$/.test(a.text));
      const success = dedup.filter((a) => /sucesso/i.test(a.text));
      const failure = dedup.filter((a) => /falha/i.test(a.text));

      // 1) Exatamente 3 anúncios de "Removendo …" (1 por tentativa).
      expect(loading, `loading announcements: ${JSON.stringify(loading)}`).to.have.length(3);

      // 2) Cada um com data-attempt distinto e crescente (1, 2, 3).
      const attempts = loading.map((a) => a.attempt);
      expect(attempts).to.deep.equal(["1", "2", "3"]);

      // 3) Cada (attempt, text) é único — ninguém repete a mesma anúncio na
      //    mesma tentativa (defesa contra re-render duplicado).
      const keys = loading.map((a) => `${a.attempt}|${a.text}`);
      expect(new Set(keys).size).to.equal(keys.length);

      // 4) 2 anúncios de "Falha" (uma para cada tentativa que falhou) e
      //    1 de "sucesso" no final.
      expect(failure).to.have.length(2);
      expect(success).to.have.length(1);

      // 5) Ordem estrita: load1, fail1, load2, fail2, load3, success.
      const sequence = dedup.map((a) => {
        if (/^Removendo /.test(a.text)) return `load:${a.attempt}`;
        if (/falha/i.test(a.text)) return `fail:${a.attempt}`;
        if (/sucesso/i.test(a.text)) return "success";
        return `other:${a.text}`;
      });
      expect(sequence).to.deep.equal([
        "load:1", "fail:1",
        "load:2", "fail:2",
        "load:3", "success",
      ]);

      // 6) Após qualquer "Tentar novamente", o texto anterior NÃO reaparece.
      //    Confirma varrendo: entre dois "load" consecutivos não pode haver
      //    re-anúncio do "fail" anterior.
      for (let i = 0; i < dedup.length - 1; i++) {
        const cur = dedup[i];
        for (let j = i + 1; j < dedup.length; j++) {
          const nxt = dedup[j];
          if (cur.text === nxt.text && cur.attempt === nxt.attempt) {
            throw new Error(
              `Mensagem repetida fora de ordem em ${i}→${j}: ${cur.text} (attempt ${cur.attempt})`,
            );
          }
        }
      }
    });
  });
});
