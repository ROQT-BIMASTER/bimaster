/**
 * Integração — divergência TRANSITÓRIA entre `docStatus` (status bruto) e o
 * `bucket` de fluxo já renderizado na UI.
 *
 * Cenário real: durante uma atualização de status (update otimista, resposta
 * do realtime chegando antes/depois do refetch), o componente pode receber por
 * um instante o status novo com o bucket antigo — ou vice-versa.
 *
 * Regra do módulo: o status bruto SEMPRE prevalece sobre o bucket herdado, e
 * quando não há status bruto o bucket é a única referência. Nenhum dos dois
 * caminhos pode gerar tela quebrada, rótulo vazio ou perda do item.
 */
import { describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  bucketFluxo,
  checklistStatusTexto,
  consolidarDecisoes,
  docStatusVisual,
  normalizarDecisao,
  type FluxoBucket,
} from "@/lib/china/docStatus";
import { bucketForDoc, bucketToTone, type FlowBucket } from "@/lib/china/flowTones";
import { DocStatusTag } from "@/components/china/DocStatusTag";
import { FlowNode } from "@/components/china/inbox/ChecklistFlow/FlowNode";

const FLUXO_TO_BUCKET: Record<FluxoBucket, FlowBucket> = {
  nao_criado: "pendente",
  rascunho: "pendente",
  pendente_envio: "pendente",
  enviado: "enviado",
  em_analise: "em_analise",
  aprovado: "aprovado",
  devolvido: "rejeitado",
};

const rotulo = (status: string) => {
  const t = checklistStatusTexto(status);
  return `${t.pt} ${t.zh}`;
};

/** Transições reais do fluxo China → Brasil (status anterior → novo). */
const TRANSICOES: Array<[string, string]> = [
  ["rascunho", "enviado_brasil"],
  ["enviado_brasil", "em_analise"],
  ["em_analise", "aprovado"],
  ["em_analise", "rejeitado"],
  ["rejeitado", "em_revisao"],
  ["contestado", "aprovado"],
  ["aprovado", "devolvido_china"],
];

describe("China — divergência transitória entre docStatus e bucketFluxo", () => {
  it("status bruto novo prevalece sobre bucket antigo ainda não recalculado", () => {
    for (const [antigo, novo] of TRANSICOES) {
      const bucketAntigo = FLUXO_TO_BUCKET[bucketFluxo(antigo)];

      cleanup();
      render(<FlowNode label="Etapa" bucket={bucketAntigo} status={novo} />);

      // A etiqueta reflete o status novo, mesmo com o bucket defasado.
      expect(screen.getByText(rotulo(novo))).toBeInTheDocument();
      expect(screen.queryByText(rotulo(antigo))).not.toBeInTheDocument();
    }
    cleanup();
  });

  it("bucket novo sem status bruto usa o status de referência do bucket", () => {
    // Refetch trouxe o bucket atualizado mas o doc ainda não veio (status null).
    cleanup();
    render(<FlowNode label="Etapa" bucket="aprovado" status={null} />);
    expect(screen.getByText(rotulo("aprovado"))).toBeInTheDocument();

    cleanup();
    render(<FlowNode label="Etapa" bucket="rejeitado" status={undefined} />);
    expect(screen.getByText(rotulo("rejeitado"))).toBeInTheDocument();
    cleanup();
  });

  it("status intermediário desconhecido degrada para pendente sem quebrar a UI", () => {
    // Ex.: backend grava um status novo antes do front conhecer o vocabulário.
    const desconhecido = "aguardando_reanalise_xyz";
    expect(bucketFluxo(desconhecido)).toBe("pendente_envio");
    expect(normalizarDecisao(desconhecido)).toBe("pendente");
    expect(bucketForDoc({ doc_status: desconhecido })).toBe("pendente");

    cleanup();
    render(<DocStatusTag status={desconhecido} />);
    // Sem rótulo cadastrado, cai no próprio código — nunca vazio.
    expect(screen.getByText(new RegExp(desconhecido))).toBeInTheDocument();
    cleanup();
  });

  it("string vazia/whitespace durante o update é tratada como não criado", () => {
    for (const bruto of ["", "   ", null, undefined]) {
      expect(bucketFluxo(bruto)).toBe("nao_criado");
      expect(bucketForDoc({ doc_status: bruto as string | null })).toBe("nao_criado");
      expect(normalizarDecisao(bruto)).toBe("pendente");
    }
  });

  it("status com caixa/espaços diferentes converge para o mesmo bucket e tom", () => {
    const variantes = ["Aprovado", " APROVADO ", "aprovado"];
    for (const v of variantes) {
      expect(bucketFluxo(v)).toBe("aprovado");
    }
    // A etiqueta normaliza a caixa antes de escolher o visual.
    expect(docStatusVisual("APROVADO").tom).toBe(docStatusVisual("aprovado").tom);
  });

  it("lista com itens em estados mistos durante o lote mantém a pior decisão", () => {
    // Update em lote: parte dos itens já com o status novo, parte com o antigo.
    const emTransicao = ["aprovado", "aprovado", "em_analise"];
    expect(consolidarDecisoes(emTransicao)).toBe("em_analise");

    const finalizado = ["aprovado", "aprovado", "ciencia"];
    expect(consolidarDecisoes(finalizado)).toBe("aprovado");

    // Rejeição pesa mais que análise mesmo que chegue por último.
    expect(consolidarDecisoes(["em_analise", "rejeitado"])).toBe("rejeitado");
  });

  it("bucket e status divergentes nunca produzem tom indefinido no nó do fluxo", () => {
    const buckets: FlowBucket[] = [
      "pendente",
      "enviado",
      "em_analise",
      "aprovado",
      "rejeitado",
      "nao_criado",
    ];
    for (const bucket of buckets) {
      expect(bucketToTone(bucket)).toBeTruthy();
      for (const status of ["aprovado", "rejeitado", "em_analise", "enviado_brasil", null]) {
        cleanup();
        render(<FlowNode label="Etapa" bucket={bucket} status={status} />);
        const esperado = status ? rotulo(status) : undefined;
        if (esperado) expect(screen.getByText(esperado)).toBeInTheDocument();
        expect(screen.getByRole("button")).toBeInTheDocument();
      }
    }
    cleanup();
  });

  it("reconciliação: após o refetch, bucket e status voltam a concordar", () => {
    for (const [, novo] of TRANSICOES) {
      const bucketReconciliado = FLUXO_TO_BUCKET[bucketFluxo(novo)];
      expect(bucketForDoc({ doc_status: novo })).toBe(bucketReconciliado);

      cleanup();
      render(<FlowNode label="Etapa" bucket={bucketReconciliado} status={novo} />);
      expect(screen.getByText(rotulo(novo))).toBeInTheDocument();
    }
    cleanup();
  });
});
