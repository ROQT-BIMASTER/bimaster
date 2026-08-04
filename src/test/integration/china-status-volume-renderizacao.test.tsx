/**
 * Integração — volume: sincronização de status e renderização do fluxo China
 * com um lote grande de documentos.
 *
 * Objetivo: garantir que o vocabulário único (`docStatus`/`bucketFluxo`) e a UI
 * (chips, nós do fluxo, contagens por coluna) permanecem corretos e estáveis
 * quando o Kanban/Checklist recebe centenas de documentos e passa por várias
 * rodadas de sincronização.
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  STATUS_TO_FLUXO,
  bucketFluxo,
  checklistStatusTexto,
  consolidarDecisoes,
  docStatusVisual,
  normalizarDecisao,
  type FluxoBucket,
} from "@/lib/china/docStatus";
import { bucketForDoc, bucketToTone, type FlowBucket } from "@/lib/china/flowTones";
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
const TOTAL = 600;

/** Gerador determinístico (sem dependência de Math.random). */
function lote(total: number, offset = 0) {
  return Array.from({ length: total }, (_, i) => ({
    id: `doc-${i}`,
    doc_status: STATUSES[(i * 7 + offset) % STATUSES.length],
  }));
}

const bucketDe = (status: string) => FLUXO_TO_BUCKET[bucketFluxo(status)];
const colunaDe = (status: string, p: "china" | "brasil") =>
  BUCKET_TO_COLUMN[p][bucketDe(status)];

function contarPorBucket(docs: Array<{ doc_status: string }>) {
  return docs.reduce<Partial<Record<FlowBucket, number>>>((acc, d) => {
    const b = bucketDe(d.doc_status);
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});
}

function contarPorColuna(docs: Array<{ doc_status: string }>, p: "china" | "brasil") {
  return docs.reduce<Record<string, number>>((acc, d) => {
    const col = colunaDe(d.doc_status, p);
    acc[col] = (acc[col] || 0) + 1;
    return acc;
  }, {});
}

const rotuloDe = (status: string) => {
  const t = checklistStatusTexto(status);
  return `${t.pt} ${t.zh}`;
};

describe("China — volume: sincronização e UI com lote grande de documentos", () => {
  it(`classifica ${TOTAL} documentos de forma determinística e sem perdas`, () => {
    const docs = lote(TOTAL);
    const counts = contarPorBucket(docs);

    // Toda a base foi classificada; nenhum bucket fora do vocabulário.
    const soma = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    expect(soma).toBe(TOTAL);
    for (const b of Object.keys(counts)) {
      expect(FILTER_BUCKETS.map((f) => f.bucket)).toContain(b as FlowBucket);
    }

    // bucketForDoc concorda com bucketFluxo em 100% dos itens.
    for (const d of docs) {
      expect(bucketForDoc(d)).toBe(bucketDe(d.doc_status));
    }

    // Determinismo: recalcular o mesmo lote produz exatamente o mesmo resultado.
    expect(contarPorBucket(lote(TOTAL))).toEqual(counts);
  });

  it("contagens por coluna batem com o total nas duas perspectivas", () => {
    const docs = lote(TOTAL);
    for (const p of ["china", "brasil"] as const) {
      const colunas = contarPorColuna(docs, p);
      const soma = Object.values(colunas).reduce((a, b) => a + b, 0);
      expect(soma).toBe(TOTAL);
      // Nenhuma coluna negativa/zerada por engano.
      for (const n of Object.values(colunas)) expect(n).toBeGreaterThan(0);
    }

    // Aprovados e rejeitados são os mesmos itens nas duas visões.
    const aprovados = docs.filter((d) => bucketDe(d.doc_status) === "aprovado").length;
    expect(contarPorColuna(docs, "china").approved).toBe(aprovados);
    expect(contarPorColuna(docs, "brasil").approved).toBe(aprovados);
  });

  it("várias rodadas de sincronização mantêm o total e a coerência dos buckets", () => {
    let docs = lote(TOTAL);

    for (let rodada = 1; rodada <= 8; rodada++) {
      // Sincronização: cada doc recebe um novo status do vocabulário.
      docs = docs.map((d, i) => ({
        ...d,
        doc_status: STATUSES[(i * 7 + rodada * 3) % STATUSES.length],
      }));

      const counts = contarPorBucket(docs);
      const soma = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
      expect(soma).toBe(TOTAL);

      // Chips e colunas derivam do MESMO conjunto — somas idênticas.
      for (const p of ["china", "brasil"] as const) {
        const totalColunas = Object.values(contarPorColuna(docs, p)).reduce((a, b) => a + b, 0);
        expect(totalColunas).toBe(soma);
      }

      // Decisão administrativa continua coerente com o estágio do fluxo.
      for (const d of docs) {
        const bucket = bucketFluxo(d.doc_status);
        const decisao = normalizarDecisao(d.doc_status);
        if (bucket === "aprovado") expect(decisao).toBe("aprovado");
        if (bucket === "devolvido") expect(decisao).toBe("rejeitado");
        if (bucket === "em_analise") expect(decisao).toBe("em_analise");
      }
    }
  });

  it("chips exibem as contagens reais do lote grande", () => {
    const docs = lote(TOTAL);
    const counts = contarPorBucket(docs);

    render(<ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} />);

    for (const { bucket, statusRef } of FILTER_BUCKETS) {
      const esperado = counts[bucket];
      if (!esperado) continue;
      const chip = screen
        .getAllByRole("button")
        .find((b) => within(b).queryByText(rotuloDe(statusRef)))!;
      expect(chip).toBeDefined();
      expect(within(chip).getByText(String(esperado))).toBeInTheDocument();
    }
    cleanup();
  });

  it("renderiza 200 nós do fluxo com etiqueta e paleta corretas", () => {
    const docs = lote(200, 2);

    render(
      <div>
        {docs.map((d) => (
          <FlowNode
            key={d.id}
            label={d.id}
            bucket={bucketDe(d.doc_status)}
            status={d.doc_status}
          />
        ))}
      </div>,
    );

    // Todos os nós foram montados.
    expect(screen.getAllByRole("button")).toHaveLength(docs.length);

    // Cada status distinto aparece com a quantidade exata de etiquetas.
    const porRotulo = docs.reduce<Record<string, number>>((acc, d) => {
      const r = rotuloDe(d.doc_status);
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    for (const [rotulo, qtd] of Object.entries(porRotulo)) {
      expect(screen.getAllByText(rotulo)).toHaveLength(qtd);
    }

    // Amostragem de paleta: 1 nó de cada bucket presente carrega o badge certo.
    const vistos = new Set<FlowBucket>();
    for (const d of docs) {
      const b = bucketDe(d.doc_status);
      if (vistos.has(b)) continue;
      vistos.add(b);
      const etiqueta = screen.getAllByText(rotuloDe(d.doc_status))[0].parentElement!;
      for (const classe of docStatusVisual(d.doc_status).badge.split(" ")) {
        expect(etiqueta.className).toContain(classe);
      }
      expect(bucketToTone(b)).toBeTruthy();
    }
    cleanup();
  });

  it("consolidação de tarefas com muitos documentos segue a pior decisão", () => {
    const todosAprovados = Array.from({ length: 300 }, (_, i) =>
      i % 2 === 0 ? "aprovado" : "ciencia",
    );
    expect(consolidarDecisoes(todosAprovados)).toBe("aprovado");

    // Um único rejeitado no meio de 300 aprovados domina a consolidação.
    const comRejeitado = [...todosAprovados];
    comRejeitado[157] = "rejeitado";
    expect(consolidarDecisoes(comRejeitado)).toBe("rejeitado");

    // Sem rejeitado, análise pesa mais que pendente.
    const comAnalise = [...todosAprovados];
    comAnalise[10] = "pendente";
    comAnalise[11] = "em_analise";
    expect(consolidarDecisoes(comAnalise)).toBe("em_analise");
  });

  it("lote com status desconhecidos e nulos não desestabiliza contagens", () => {
    const docs = [
      ...lote(300),
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `x-${i}`,
        doc_status: i % 2 === 0 ? (`status_novo_${i % 5}` as string) : "",
      })),
    ];

    const counts = contarPorBucket(docs as Array<{ doc_status: string }>);
    const soma = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    expect(soma).toBe(docs.length);

    // Desconhecidos e vazios caem em "pendente" — nunca somem da tela.
    expect(bucketDe("status_novo_1")).toBe("pendente");
    expect(bucketDe("")).toBe("pendente");
  });
});
