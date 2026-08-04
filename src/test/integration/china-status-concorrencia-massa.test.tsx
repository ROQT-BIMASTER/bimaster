/**
 * Integração — concorrência: atualizações de status em massa simultâneas.
 *
 * Objetivo: garantir que, quando vários operadores (ou o tempo real do backend)
 * enviam lotes de atualização ao mesmo tempo — inclusive fora de ordem, com
 * eventos duplicados e sobrepostos —, a reconciliação de estado e a renderização
 * (nós do fluxo, chips e contagens por coluna) permanecem corretas e
 * determinísticas.
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  STATUS_TO_FLUXO,
  bucketFluxo,
  checklistStatusTexto,
  docStatusVisual,
  normalizarDecisao,
  type FluxoBucket,
} from "@/lib/china/docStatus";
import { bucketForDoc, type FlowBucket } from "@/lib/china/flowTones";
import { FlowNode } from "@/components/china/inbox/ChecklistFlow/FlowNode";
import { ChinaStatusFilterChips, FILTER_BUCKETS } from "@/components/china/ChinaStatusFilterChips";

const FLUXO_TO_BUCKET: Record<FluxoBucket, FlowBucket> = {
  nao_criado: "pendente",
  rascunho: "pendente",
  pendente_envio: "pendente",
  enviado: "enviado",
  em_analise: "em_analise",
  aprovado: "aprovado",
  devolvido: "rejeitado",
};

const BUCKET_TO_COLUMN: Record<"china" | "brasil", Record<FlowBucket, string>> = {
  china: {
    aprovado: "approved",
    rejeitado: "returned",
    em_analise: "in_analysis",
    enviado: "sent_brazil",
    pendente: "awaiting_send",
    nao_criado: "awaiting_send",
  },
  brasil: {
    aprovado: "approved",
    rejeitado: "rejected",
    em_analise: "inbox",
    enviado: "inbox",
    pendente: "inbox",
    nao_criado: "inbox",
  },
};

const STATUSES = Object.keys(STATUS_TO_FLUXO);
const TOTAL = 240;

interface Doc {
  id: string;
  doc_status: string;
  /** Versão lógica vinda do backend (updated_at monotônico simulado). */
  rev: number;
}

interface Evento {
  id: string;
  doc_status: string;
  rev: number;
}

const bucketDe = (status: string) => FLUXO_TO_BUCKET[bucketFluxo(status)];
const rotuloDe = (status: string) => {
  const t = checklistStatusTexto(status);
  return `${t.pt} ${t.zh}`;
};

function baseDocs(total = TOTAL): Doc[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `doc-${i}`,
    doc_status: "pendente",
    rev: 0,
  }));
}

/**
 * Reconciliação usada pela UI: aplica um evento apenas se ele for mais novo
 * que o estado local (last-write-wins por revisão). Eventos duplicados ou
 * atrasados são descartados.
 */
function aplicarEventos(docs: Doc[], eventos: Evento[]): Doc[] {
  const porId = new Map(docs.map((d) => [d.id, d]));
  for (const ev of eventos) {
    const atual = porId.get(ev.id);
    if (!atual) continue;
    if (ev.rev <= atual.rev) continue;
    porId.set(ev.id, { id: ev.id, doc_status: ev.doc_status, rev: ev.rev });
  }
  return docs.map((d) => porId.get(d.id)!);
}

/** Lote de atualização em massa emitido por um operador. */
function loteOperador(docs: Doc[], operador: number, rev: number): Evento[] {
  return docs
    .filter((_, i) => i % 3 === operador)
    .map((d, i) => ({
      id: d.id,
      doc_status: STATUSES[(i * 5 + operador * 2 + rev) % STATUSES.length],
      rev,
    }));
}

/** Embaralhamento determinístico (sem Math.random) para simular fora de ordem. */
function embaralhar<T>(itens: T[], semente: number): T[] {
  return itens
    .map((item, i) => ({ item, k: (i * 31 + semente * 17) % itens.length }))
    .sort((a, b) => a.k - b.k)
    .map(({ item }) => item);
}

function contarPorBucket(docs: Doc[]) {
  return docs.reduce<Partial<Record<FlowBucket, number>>>((acc, d) => {
    const b = bucketDe(d.doc_status);
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});
}

function contarPorColuna(docs: Doc[], p: "china" | "brasil") {
  return docs.reduce<Record<string, number>>((acc, d) => {
    const col = BUCKET_TO_COLUMN[p][bucketDe(d.doc_status)];
    acc[col] = (acc[col] || 0) + 1;
    return acc;
  }, {});
}

describe("China — concorrência: atualizações de status em massa", () => {
  it("três operadores em paralelo produzem estado final determinístico", () => {
    const inicial = baseDocs();
    const eventos = [
      ...loteOperador(inicial, 0, 1),
      ...loteOperador(inicial, 1, 1),
      ...loteOperador(inicial, 2, 1),
    ];

    const final = aplicarEventos(inicial, eventos);
    // Nenhum documento perdido e todos avançaram de revisão.
    expect(final).toHaveLength(TOTAL);
    expect(final.every((d) => d.rev === 1)).toBe(true);

    // Reexecutar a mesma sequência produz exatamente o mesmo resultado.
    expect(aplicarEventos(baseDocs(), eventos)).toEqual(final);
  });

  it("ordem de chegada dos eventos não altera o estado final", () => {
    const inicial = baseDocs();
    const eventos = [
      ...loteOperador(inicial, 0, 1),
      ...loteOperador(inicial, 1, 1),
      ...loteOperador(inicial, 2, 1),
    ];
    const esperado = aplicarEventos(inicial, eventos);

    for (const semente of [1, 2, 3, 7, 11]) {
      const fora = aplicarEventos(baseDocs(), embaralhar(eventos, semente));
      expect(fora).toEqual(esperado);
      expect(contarPorBucket(fora)).toEqual(contarPorBucket(esperado));
    }
  });

  it("evento atrasado de revisão antiga não sobrescreve o status mais novo", () => {
    const inicial = baseDocs(10);
    const novo = aplicarEventos(
      inicial,
      inicial.map((d) => ({ id: d.id, doc_status: "aprovado", rev: 5 })),
    );
    expect(novo.every((d) => d.doc_status === "aprovado")).toBe(true);

    // Chegada tardia de um lote antigo (rev menor) é ignorada.
    const atrasado = aplicarEventos(
      novo,
      novo.map((d) => ({ id: d.id, doc_status: "pendente", rev: 2 })),
    );
    expect(atrasado.every((d) => d.doc_status === "aprovado" && d.rev === 5)).toBe(true);
    expect(contarPorBucket(atrasado)).toEqual({ aprovado: 10 });
  });

  it("eventos duplicados são idempotentes nas contagens", () => {
    const inicial = baseDocs();
    const eventos = [
      ...loteOperador(inicial, 0, 1),
      ...loteOperador(inicial, 1, 1),
      ...loteOperador(inicial, 2, 1),
    ];
    const umaVez = aplicarEventos(inicial, eventos);
    const tresVezes = aplicarEventos(inicial, [...eventos, ...eventos, ...eventos]);

    expect(tresVezes).toEqual(umaVez);
    for (const p of ["china", "brasil"] as const) {
      expect(contarPorColuna(tresVezes, p)).toEqual(contarPorColuna(umaVez, p));
    }
  });

  it("rodadas concorrentes sucessivas mantêm total, buckets e colunas coerentes", () => {
    let docs = baseDocs();

    for (let rev = 1; rev <= 6; rev++) {
      const eventos = embaralhar(
        [
          ...loteOperador(docs, 0, rev),
          ...loteOperador(docs, 1, rev),
          ...loteOperador(docs, 2, rev),
        ],
        rev,
      );
      docs = aplicarEventos(docs, eventos);

      const counts = contarPorBucket(docs);
      const soma = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
      expect(soma).toBe(TOTAL);

      for (const p of ["china", "brasil"] as const) {
        const total = Object.values(contarPorColuna(docs, p)).reduce((a, b) => a + b, 0);
        expect(total).toBe(TOTAL);
      }

      // Vocabulário único: bucketForDoc e a decisão administrativa não divergem.
      for (const d of docs) {
        expect(bucketForDoc(d)).toBe(bucketDe(d.doc_status));
        const fluxo = bucketFluxo(d.doc_status);
        if (fluxo === "aprovado") expect(normalizarDecisao(d.doc_status)).toBe("aprovado");
        if (fluxo === "devolvido") expect(normalizarDecisao(d.doc_status)).toBe("rejeitado");
        if (fluxo === "em_analise") expect(normalizarDecisao(d.doc_status)).toBe("em_analise");
      }
    }
  });

  it("UI renderizada após a concorrência reflete exatamente o estado reconciliado", () => {
    const inicial = baseDocs(120);
    const eventos = embaralhar(
      [
        ...loteOperador(inicial, 0, 1),
        ...loteOperador(inicial, 1, 1),
        ...loteOperador(inicial, 2, 1),
      ],
      5,
    );
    const docs = aplicarEventos(inicial, eventos);
    const counts = contarPorBucket(docs);

    render(
      <div>
        <ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} />
        {docs.map((d) => (
          <FlowNode key={d.id} label={d.id} bucket={bucketDe(d.doc_status)} status={d.doc_status} />
        ))}
      </div>,
    );

    // Cada etiqueta aparece a quantidade exata de vezes (nós + eventual chip).
    const chipsVisiveis = new Set(
      FILTER_BUCKETS.filter(({ bucket }) => (counts[bucket] || 0) > 0).map(
        ({ statusRef }) => rotuloDe(statusRef),
      ),
    );
    const porRotulo = docs.reduce<Record<string, number>>((acc, d) => {
      const r = rotuloDe(d.doc_status);
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    for (const [rotulo, qtd] of Object.entries(porRotulo)) {
      const esperado = qtd + (chipsVisiveis.has(rotulo) ? 1 : 0);
      expect(screen.getAllByText(rotulo)).toHaveLength(esperado);
    }

    // Chips mostram as contagens reconciliadas.
    for (const { bucket, statusRef } of FILTER_BUCKETS) {
      const esperado = counts[bucket];
      if (!esperado) continue;
      const chip = screen
        .getAllByRole("button")
        .find((b) => within(b).queryByText(rotuloDe(statusRef)) && within(b).queryByText(String(esperado)));
      expect(chip).toBeDefined();
    }

    // Paleta coerente com o status final de cada bucket presente.
    const vistos = new Set<FlowBucket>();
    for (const d of docs) {
      const b = bucketDe(d.doc_status);
      if (vistos.has(b)) continue;
      vistos.add(b);
      const etiqueta = screen
        .getAllByText(rotuloDe(d.doc_status))
        .map((el) => el.parentElement!)
        .find((el) => el.className.includes("rounded-md border"))!;
      expect(etiqueta).toBeDefined();
      for (const classe of docStatusVisual(d.doc_status).badge.split(" ")) {
        expect(etiqueta.className).toContain(classe);
      }
    }
    cleanup();
  });
});
