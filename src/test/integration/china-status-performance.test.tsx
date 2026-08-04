/**
 * Orçamento de performance — sincronização de status e renderização do fluxo
 * China em volume alto.
 *
 * O teste mede:
 *  - tempo de classificação/sincronização de um lote grande de documentos
 *    (vocabulário único `docStatus`/`bucketFluxo`);
 *  - tempo de renderização dos nós do fluxo e dos chips de contagem.
 *
 * Falha se qualquer etapa ultrapassar o orçamento definido, protegendo contra
 * regressões de performance na Caixa de Entrada e no Checklist.
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  STATUS_TO_FLUXO,
  bucketFluxo,
  consolidarDecisoes,
  normalizarDecisao,
  type FluxoBucket,
} from "@/lib/china/docStatus";
import { bucketForDoc, type FlowBucket } from "@/lib/china/flowTones";
import { FlowNode } from "@/components/china/inbox/ChecklistFlow/FlowNode";
import { ChinaStatusFilterChips } from "@/components/china/ChinaStatusFilterChips";

/**
 * Orçamentos (ms). Valores folgados o suficiente para não oscilar em CI
 * compartilhada, mas apertados o bastante para pegar regressões de ordem de
 * grandeza (ex.: comparação de status em cascata, recomputo por render).
 */
const ORCAMENTO = {
  /** Classificar 2.000 documentos (bucket + decisão). */
  sincronizacaoLote: 150,
  /** 10 rodadas de sincronização sobre 1.000 documentos. */
  sincronizacaoRodadas: 400,
  /** Renderizar 300 nós do fluxo. */
  renderNos: 3_000,
  /** Renderizar o conjunto de chips com contagens. */
  renderChips: 300,
  /** Consolidar decisão de 5.000 documentos por tarefa. */
  consolidacao: 100,
} as const;

const FLUXO_TO_BUCKET: Record<FluxoBucket, FlowBucket> = {
  nao_criado: "pendente",
  rascunho: "pendente",
  pendente_envio: "pendente",
  enviado: "enviado",
  em_analise: "em_analise",
  aprovado: "aprovado",
  devolvido: "rejeitado",
};

const STATUSES = Object.keys(STATUS_TO_FLUXO);
const bucketDe = (status: string) => FLUXO_TO_BUCKET[bucketFluxo(status)];

function lote(total: number, offset = 0) {
  return Array.from({ length: total }, (_, i) => ({
    id: `doc-${i}`,
    doc_status: STATUSES[(i * 7 + offset) % STATUSES.length],
  }));
}

function contarPorBucket(docs: Array<{ doc_status: string }>) {
  return docs.reduce<Partial<Record<FlowBucket, number>>>((acc, d) => {
    const b = bucketDe(d.doc_status);
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});
}

/** Mede o tempo de execução (ms) e devolve o resultado junto. */
function medir<T>(fn: () => T): { ms: number; valor: T } {
  const inicio = performance.now();
  const valor = fn();
  return { ms: performance.now() - inicio, valor };
}

/** Mediana de várias amostras — reduz ruído de GC/JIT em CI. */
function medianaMs(amostras: number, fn: () => void): number {
  const tempos: number[] = [];
  for (let i = 0; i < amostras; i++) tempos.push(medir(fn).ms);
  tempos.sort((a, b) => a - b);
  return tempos[Math.floor(tempos.length / 2)];
}

describe("Performance — sincronização de status em volume alto", () => {
  it(`classifica 2.000 documentos em menos de ${ORCAMENTO.sincronizacaoLote}ms`, () => {
    const docs = lote(2_000);

    // Aquecimento (JIT) fora da medição.
    contarPorBucket(docs);

    const ms = medianaMs(3, () => {
      for (const d of docs) {
        bucketFluxo(d.doc_status);
        bucketForDoc(d);
        normalizarDecisao(d.doc_status);
      }
    });

    expect(contarPorBucket(docs)).toBeTruthy();
    expect(ms, `sincronização levou ${ms.toFixed(1)}ms`).toBeLessThan(
      ORCAMENTO.sincronizacaoLote,
    );
  });

  it(`10 rodadas sobre 1.000 documentos em menos de ${ORCAMENTO.sincronizacaoRodadas}ms`, () => {
    let docs = lote(1_000);
    contarPorBucket(docs); // aquecimento

    const { ms } = medir(() => {
      for (let rodada = 1; rodada <= 10; rodada++) {
        docs = docs.map((d, i) => ({
          ...d,
          doc_status: STATUSES[(i * 7 + rodada * 3) % STATUSES.length],
        }));
        const counts = contarPorBucket(docs);
        const soma = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
        if (soma !== docs.length) throw new Error("perda de documentos na sincronização");
      }
    });

    expect(ms, `10 rodadas levaram ${ms.toFixed(1)}ms`).toBeLessThan(
      ORCAMENTO.sincronizacaoRodadas,
    );
  });

  it(`consolida 5.000 decisões em menos de ${ORCAMENTO.consolidacao}ms`, () => {
    const statuses = lote(5_000, 3).map((d) => d.doc_status);
    consolidarDecisoes(statuses.slice(0, 100)); // aquecimento

    const { ms, valor } = medir(() => consolidarDecisoes(statuses));
    expect(valor).toBeTruthy();
    expect(ms, `consolidação levou ${ms.toFixed(1)}ms`).toBeLessThan(ORCAMENTO.consolidacao);
  });
});

describe("Performance — renderização do UI em volume alto", () => {
  it(`renderiza 300 nós do fluxo em menos de ${ORCAMENTO.renderNos}ms`, () => {
    const docs = lote(300, 2);

    // Aquecimento: primeira montagem do componente (custo único de módulo/ícones).
    render(<FlowNode label="warm" bucket="pendente" status="pendente" />);
    cleanup();

    const { ms } = medir(() => {
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
    });

    expect(screen.getAllByRole("button")).toHaveLength(docs.length);
    cleanup();
    expect(ms, `render de 300 nós levou ${ms.toFixed(1)}ms`).toBeLessThan(ORCAMENTO.renderNos);
  });

  it(`renderiza os chips de contagem em menos de ${ORCAMENTO.renderChips}ms`, () => {
    const counts = contarPorBucket(lote(2_000));

    render(<ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} />);
    cleanup();

    const ms = medianaMs(3, () => {
      render(<ChinaStatusFilterChips counts={counts} selected={["aprovado"]} onChange={() => {}} />);
      cleanup();
    });

    expect(ms, `render dos chips levou ${ms.toFixed(1)}ms`).toBeLessThan(ORCAMENTO.renderChips);
  });

  it("custo de renderização cresce de forma aproximadamente linear com o volume", () => {
    render(<FlowNode label="warm" bucket="pendente" status="pendente" />);
    cleanup();

    const tempoPara = (total: number) => {
      const docs = lote(total, 4);
      const { ms } = medir(() => {
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
      });
      cleanup();
      return ms;
    };

    const t100 = Math.max(tempoPara(100), 1);
    const t300 = tempoPara(300);

    // 3x de volume não pode custar mais que ~9x de tempo (guarda contra
    // comportamento quadrático em contagens/derivações por item).
    expect(t300 / t100, `100=${t100.toFixed(1)}ms 300=${t300.toFixed(1)}ms`).toBeLessThan(9);
  });
});
