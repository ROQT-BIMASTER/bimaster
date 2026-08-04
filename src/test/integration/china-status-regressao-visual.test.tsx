/**
 * Regressão visual — nós do fluxo (`FlowNode`) e chips de contagem
 * (`ChinaStatusFilterChips`).
 *
 * Estes testes congelam a marcação renderizada (paleta, ícone e layout) por meio
 * de snapshots. Qualquer alteração de classes de cor, tamanho, ícone ou estrutura
 * quebra o teste de propósito: a mudança precisa ser revisada e o snapshot
 * atualizado conscientemente (`bunx vitest -u`).
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FlowNode } from "@/components/china/inbox/ChecklistFlow/FlowNode";
import { ChinaStatusFilterChips, FILTER_BUCKETS } from "@/components/china/ChinaStatusFilterChips";
import { DocStatusTag } from "@/components/china/DocStatusTag";
import {
  checklistStatusTexto,
  docStatusIconComponent,
  docStatusVisual,
} from "@/lib/china/docStatus";
import { FLOW_TONE, bucketToTone, iconForBucket, type FlowBucket } from "@/lib/china/flowTones";

const BUCKETS: FlowBucket[] = [
  "em_analise",
  "aprovado",
  "rejeitado",
  "enviado",
  "pendente",
  "nao_criado",
];

const STATUS_REF: Record<FlowBucket, string> = {
  em_analise: "em_analise",
  aprovado: "aprovado",
  rejeitado: "rejeitado",
  enviado: "enviado_brasil",
  pendente: "pendente",
  nao_criado: "nao_criado",
};

const rotuloDe = (status: string) => {
  const t = checklistStatusTexto(status);
  return `${t.pt} ${t.zh}`;
};

/** Normaliza a ordem das classes para o snapshot não depender de ordenação. */
const classes = (el: Element) =>
  el.className.split(/\s+/).filter(Boolean).sort().join(" ");

describe("Regressão visual — FlowNode", () => {
  it.each(BUCKETS)("nó do bucket %s mantém marcação estável", (bucket) => {
    const { container } = render(
      <FlowNode label="Ficha técnica" labelCn="技术表" bucket={bucket} status={STATUS_REF[bucket]} />,
    );
    expect(container.firstElementChild).toMatchSnapshot();
    cleanup();
  });

  it.each(BUCKETS)("círculo do bucket %s usa a paleta do tom correspondente", (bucket) => {
    render(<FlowNode label="Doc" bucket={bucket} status={STATUS_REF[bucket]} />);
    const circulo = screen.getByRole("button").firstElementChild!;
    const cfg = FLOW_TONE[bucketToTone(bucket)];
    for (const classe of [cfg.ring, cfg.border, cfg.bg]) {
      expect(circulo.className).toContain(classe);
    }
    // Ícone do bucket (SVG) presente e com a cor do tom.
    const svg = circulo.querySelector("svg")!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("class")).toContain(cfg.text);
    expect(iconForBucket(bucket)).toBeTruthy();
    // Layout: dimensões fixas do círculo não mudam entre versões.
    expect(circulo.className).toContain("h-11");
    expect(circulo.className).toContain("w-11");
    cleanup();
  });

  it("estado selecionado e indicador de ação mantêm marcação estável", () => {
    const { container } = render(
      <FlowNode
        label="Ficha técnica"
        labelCn="技术表"
        bucket="rejeitado"
        status="rejeitado"
        selected
        needsAction
      />,
    );
    expect(container.firstElementChild).toMatchSnapshot();
    expect(screen.getByLabelText("Ação necessária")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    cleanup();
  });

  it("largura do nó e truncamento dos rótulos permanecem fixos", () => {
    render(<FlowNode label="Certificado de análise" labelCn="分析证书" bucket="aprovado" />);
    const botao = screen.getByRole("button");
    expect(botao.className).toContain("w-[88px]");
    expect(botao.className).toContain("shrink-0");
    const pt = screen.getByText("Certificado de análise");
    expect(pt.className).toContain("line-clamp-2");
    expect(pt.className).toContain("text-[10px]");
    const cn = screen.getByText("分析证书");
    expect(cn.className).toContain("line-clamp-1");
    expect(cn.className).toContain("text-[9px]");
    cleanup();
  });
});

describe("Regressão visual — DocStatusTag", () => {
  it.each(Object.values(STATUS_REF))("etiqueta do status %s mantém marcação estável", (status) => {
    const { container } = render(<DocStatusTag status={status} />);
    expect(container.firstElementChild).toMatchSnapshot();
    cleanup();
  });

  it.each(["xs", "sm"] as const)("tamanho %s mantém altura e tipografia", (size) => {
    render(<DocStatusTag status="aprovado" size={size} />);
    const tag = screen.getByText(rotuloDe("aprovado")).parentElement!;
    expect(tag.className).toContain(size === "xs" ? "h-4" : "h-5");
    expect(tag.className).toContain(size === "xs" ? "text-[9.5px]" : "text-[11px]");
    for (const classe of docStatusVisual("aprovado").badge.split(" ")) {
      expect(tag.className).toContain(classe);
    }
    cleanup();
  });

  it("ícone da etiqueta é o mesmo derivado do vocabulário único", () => {
    for (const status of Object.values(STATUS_REF)) {
      render(<DocStatusTag status={status} />);
      const tag = screen.getByText(rotuloDe(status)).parentElement!;
      expect(tag.querySelector("svg")).toBeTruthy();
      expect(docStatusIconComponent(status)).toBeTruthy();
      cleanup();
    }
  });
});

describe("Regressão visual — ChinaStatusFilterChips", () => {
  const counts: Partial<Record<FlowBucket, number>> = {
    em_analise: 4,
    aprovado: 12,
    rejeitado: 2,
    enviado: 7,
    pendente: 9,
    nao_criado: 1,
  };

  it("conjunto completo de chips (sem seleção) mantém marcação estável", () => {
    const { container } = render(
      <ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} label="Status" />,
    );
    expect(container.firstElementChild).toMatchSnapshot();
    cleanup();
  });

  it("chips com seleção ativa mantêm marcação estável", () => {
    const { container } = render(
      <ChinaStatusFilterChips
        counts={counts}
        selected={["aprovado", "rejeitado"]}
        onChange={() => {}}
      />,
    );
    expect(container.firstElementChild).toMatchSnapshot();
    cleanup();
  });

  it("chip ativo aplica a paleta do status e o inativo permanece neutro", () => {
    render(<ChinaStatusFilterChips counts={counts} selected={["aprovado"]} onChange={() => {}} />);
    const botoes = screen.getAllByRole("button");

    const ativo = botoes.find((b) => within(b).queryByText(rotuloDe("aprovado")))!;
    for (const classe of docStatusVisual("aprovado").badge.split(" ")) {
      expect(ativo.className).toContain(classe);
    }

    const inativo = botoes.find((b) => within(b).queryByText(rotuloDe("rejeitado")))!;
    for (const classe of docStatusVisual("rejeitado").badge.split(" ")) {
      expect(inativo.className).not.toContain(classe);
    }
    expect(inativo.className).toContain("text-muted-foreground");
    cleanup();
  });

  it("ordem canônica, ícone e contagem de cada chip não mudam", () => {
    render(<ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} />);
    const botoes = screen.getAllByRole("button").filter((b) => b.querySelector("svg"));

    const esperados = FILTER_BUCKETS.filter(({ bucket }) => (counts[bucket] || 0) > 0);
    expect(botoes).toHaveLength(esperados.length);

    esperados.forEach(({ bucket, statusRef }, i) => {
      const chip = botoes[i];
      expect(within(chip).getByText(rotuloDe(statusRef))).toBeInTheDocument();
      expect(within(chip).getByText(String(counts[bucket]))).toBeInTheDocument();
      expect(chip.querySelector("svg")).toBeTruthy();
    });
    cleanup();
  });

  it("chips zerados continuam ocultos por padrão e visíveis com hideEmpty falso", () => {
    const parcial: Partial<Record<FlowBucket, number>> = { aprovado: 3 };
    const { rerender } = render(
      <ChinaStatusFilterChips counts={parcial} selected={[]} onChange={() => {}} />,
    );
    expect(screen.queryByText(rotuloDe("rejeitado"))).not.toBeInTheDocument();

    rerender(
      <ChinaStatusFilterChips counts={parcial} selected={[]} onChange={() => {}} hideEmpty={false} />,
    );
    expect(screen.getByText(rotuloDe("rejeitado"))).toBeInTheDocument();
    cleanup();
  });

  it("paleta do chip e do nó do fluxo é idêntica para o mesmo status", () => {
    for (const { bucket, statusRef } of FILTER_BUCKETS) {
      render(
        <div>
          <div data-testid="chips">
            <ChinaStatusFilterChips
              counts={{ [bucket]: 1 }}
              selected={[bucket]}
              onChange={() => {}}
            />
          </div>
          <div data-testid="no">
            <FlowNode label="Doc" bucket={bucket} status={statusRef} />
          </div>
        </div>,
      );
      const chip = within(screen.getByTestId("chips")).getAllByRole("button")[0];
      const etiqueta = within(screen.getByTestId("no")).getByText(rotuloDe(statusRef))
        .parentElement!;
      const paleta = docStatusVisual(statusRef).badge.split(" ").sort().join(" ");
      for (const classe of paleta.split(" ")) {
        expect(classes(chip)).toContain(classe);
        expect(classes(etiqueta)).toContain(classe);
      }
      cleanup();
    }
  });
});
