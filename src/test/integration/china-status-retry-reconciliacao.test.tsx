/**
 * Integração — resiliência: atrasos e falhas temporárias na sincronização de
 * status dos documentos China.
 *
 * Simula um transporte instável (timeouts, erros 5xx, respostas fora de ordem)
 * e valida:
 *  - política de novas tentativas com espera progressiva;
 *  - reconciliação final do status (last-write-wins por revisão);
 *  - consistência do UI (nós do fluxo, chips e contagens) após a estabilização.
 */
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  STATUS_TO_FLUXO,
  bucketFluxo,
  checklistStatusTexto,
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

const STATUSES = Object.keys(STATUS_TO_FLUXO);
const bucketDe = (status: string) => FLUXO_TO_BUCKET[bucketFluxo(status)];
const rotuloDe = (status: string) => {
  const t = checklistStatusTexto(status);
  return `${t.pt} ${t.zh}`;
};

interface Doc {
  id: string;
  doc_status: string;
  rev: number;
}

const MAX_TENTATIVAS = 4;
const ESPERA_BASE_MS = 50;

class FalhaTemporaria extends Error {
  readonly temporaria = true;
}
class FalhaDefinitiva extends Error {
  readonly temporaria = false;
}

/** Espera progressiva determinística (sem jitter, para o teste ser estável). */
const esperaMs = (tentativa: number) => ESPERA_BASE_MS * 2 ** (tentativa - 1);

async function comRetry<T>(
  operacao: (tentativa: number) => Promise<T>,
  aoTentarNovamente?: (tentativa: number, esperaMs: number) => void,
): Promise<T> {
  let ultima: unknown;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      return await operacao(tentativa);
    } catch (e) {
      ultima = e;
      const temporaria = (e as FalhaTemporaria)?.temporaria === true;
      if (!temporaria || tentativa === MAX_TENTATIVAS) throw e;
      const espera = esperaMs(tentativa);
      aoTentarNovamente?.(tentativa, espera);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw ultima;
}

/** Aplica eventos com last-write-wins por revisão (descarta atrasados/duplicados). */
function reconciliar(docs: Doc[], eventos: Doc[]): Doc[] {
  const porId = new Map(docs.map((d) => [d.id, d]));
  for (const ev of eventos) {
    const atual = porId.get(ev.id);
    if (!atual || ev.rev <= atual.rev) continue;
    porId.set(ev.id, { ...ev });
  }
  return docs.map((d) => porId.get(d.id)!);
}

function baseDocs(total: number): Doc[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `doc-${i}`,
    doc_status: "pendente",
    rev: 0,
  }));
}

function loteAlvo(total: number, rev: number): Doc[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `doc-${i}`,
    doc_status: STATUSES[(i * 7 + rev) % STATUSES.length],
    rev,
  }));
}

function contarPorBucket(docs: Doc[]) {
  return docs.reduce<Partial<Record<FlowBucket, number>>>((acc, d) => {
    const b = bucketDe(d.doc_status);
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Transporte instável: falha temporariamente nas primeiras `falhas` chamadas,
 * responde com atraso e devolve o lote solicitado.
 */
function transporteInstavel(lote: Doc[], falhas: number, atrasoMs = 20) {
  let chamadas = 0;
  return {
    get chamadas() {
      return chamadas;
    },
    async buscar(): Promise<Doc[]> {
      chamadas++;
      await new Promise((r) => setTimeout(r, atrasoMs));
      if (chamadas <= falhas) throw new FalhaTemporaria("timeout na sincronização");
      return lote.map((d) => ({ ...d }));
    },
  };
}

describe("China — sincronização com atrasos e falhas temporárias", () => {
  it("repete a busca após falhas temporárias e reconcilia o status final", async () => {
    vi.useFakeTimers();
    try {
      const alvo = loteAlvo(60, 1);
      const transporte = transporteInstavel(alvo, 2);
      const esperas: number[] = [];

      const promessa = comRetry(
        () => transporte.buscar(),
        (_t, espera) => esperas.push(espera),
      );
      await vi.runAllTimersAsync();
      const eventos = await promessa;

      expect(transporte.chamadas).toBe(3);
      expect(esperas).toEqual([ESPERA_BASE_MS, ESPERA_BASE_MS * 2]);

      const docs = reconciliar(baseDocs(60), eventos);
      expect(docs.every((d) => d.rev === 1)).toBe(true);
      expect(contarPorBucket(docs)).toEqual(contarPorBucket(alvo));
    } finally {
      vi.useRealTimers();
    }
  });

  it("desiste após o limite de tentativas e preserva o último estado conhecido", async () => {
    vi.useFakeTimers();
    try {
      const estavel = reconciliar(baseDocs(20), loteAlvo(20, 1));
      const transporte = transporteInstavel([], MAX_TENTATIVAS + 1);

      const promessa = comRetry(() => transporte.buscar()).catch((e) => e as Error);
      await vi.runAllTimersAsync();
      const erro = await promessa;

      expect(erro).toBeInstanceOf(FalhaTemporaria);
      expect(transporte.chamadas).toBe(MAX_TENTATIVAS);

      // Falha de rede não pode zerar nem corromper o que já estava na tela.
      const apos = reconciliar(estavel, []);
      expect(apos).toEqual(estavel);
      expect(contarPorBucket(apos)).toEqual(contarPorBucket(estavel));
    } finally {
      vi.useRealTimers();
    }
  });

  it("falha definitiva não dispara novas tentativas", async () => {
    let chamadas = 0;
    const erro = await comRetry(async () => {
      chamadas++;
      throw new FalhaDefinitiva("permissão negada");
    }).catch((e) => e as Error);

    expect(erro).toBeInstanceOf(FalhaDefinitiva);
    expect(chamadas).toBe(1);
  });

  it("respostas atrasadas de revisões antigas não sobrescrevem o estado novo", async () => {
    vi.useFakeTimers();
    try {
      const antigo = transporteInstavel(loteAlvo(30, 1), 1, 200); // lento
      const novo = transporteInstavel(loteAlvo(30, 2), 0, 20); // rápido

      const pA = comRetry(() => antigo.buscar());
      const pN = comRetry(() => novo.buscar());
      await vi.runAllTimersAsync();
      const [evAntigos, evNovos] = await Promise.all([pA, pN]);

      // O lote novo chega primeiro; o antigo chega depois e deve ser descartado.
      let docs = reconciliar(baseDocs(30), evNovos);
      docs = reconciliar(docs, evAntigos);

      expect(docs.every((d) => d.rev === 2)).toBe(true);
      expect(contarPorBucket(docs)).toEqual(contarPorBucket(loteAlvo(30, 2)));
    } finally {
      vi.useRealTimers();
    }
  });

  it("sincronização parcial (páginas com falha intermitente) converge sem perdas", async () => {
    vi.useFakeTimers();
    try {
      const TOTAL = 120;
      const PAGINA = 30;
      const alvo = loteAlvo(TOTAL, 3);
      let docs = baseDocs(TOTAL);

      const promessas = [] as Array<Promise<Doc[]>>;
      for (let p = 0; p < TOTAL / PAGINA; p++) {
        const pagina = alvo.slice(p * PAGINA, (p + 1) * PAGINA);
        // Páginas ímpares falham duas vezes antes de responder.
        const transporte = transporteInstavel(pagina, p % 2 === 1 ? 2 : 0, 10 * (p + 1));
        promessas.push(comRetry(() => transporte.buscar()));
      }
      await vi.runAllTimersAsync();
      for (const eventos of await Promise.all(promessas)) {
        docs = reconciliar(docs, eventos);
      }

      expect(docs).toHaveLength(TOTAL);
      expect(docs.every((d) => d.rev === 3)).toBe(true);
      expect(contarPorBucket(docs)).toEqual(contarPorBucket(alvo));
      for (const d of docs) expect(bucketForDoc(d)).toBe(bucketDe(d.doc_status));
    } finally {
      vi.useRealTimers();
    }
  });

  it("UI reflete o estado reconciliado depois das novas tentativas", async () => {
    vi.useFakeTimers();
    let docs: Doc[] = [];
    try {
      const alvo = loteAlvo(90, 5);
      const transporte = transporteInstavel(alvo, 3, 30);
      const promessa = comRetry(() => transporte.buscar());
      await vi.runAllTimersAsync();
      docs = reconciliar(baseDocs(90), await promessa);
      expect(transporte.chamadas).toBe(4);
    } finally {
      vi.useRealTimers();
    }

    const counts = contarPorBucket(docs);
    render(
      <div>
        <div data-testid="chips">
          <ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} />
        </div>
        <div data-testid="nos">
          {docs.map((d) => (
            <FlowNode
              key={d.id}
              label={d.id}
              bucket={bucketDe(d.doc_status)}
              status={d.doc_status}
            />
          ))}
        </div>
      </div>,
    );

    const nos = within(screen.getByTestId("nos"));
    const chips = within(screen.getByTestId("chips"));

    // Nenhum documento ficou preso em "pendente" por causa das falhas.
    expect(nos.getAllByRole("button")).toHaveLength(docs.length);
    const porRotulo = docs.reduce<Record<string, number>>((acc, d) => {
      const r = rotuloDe(d.doc_status);
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    for (const [rotulo, qtd] of Object.entries(porRotulo)) {
      expect(nos.getAllByText(rotulo)).toHaveLength(qtd);
    }

    // Chips exibem exatamente as contagens reconciliadas.
    for (const { bucket, statusRef } of FILTER_BUCKETS) {
      const esperado = counts[bucket];
      if (!esperado) continue;
      const chip = chips
        .getAllByRole("button")
        .find((b) => within(b).queryByText(rotuloDe(statusRef)))!;
      expect(chip).toBeDefined();
      expect(within(chip).getByText(String(esperado))).toBeInTheDocument();
    }
    cleanup();
  });
});
