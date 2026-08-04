/**
 * Integração — sincronização de status do módulo China.
 *
 * Garante que a fonte única (`docStatus.ts` / `bucketFluxo`) chega idêntica
 * na UI: etiquetas (DocStatusTag), chips de filtro, nós do fluxo (FlowNode)
 * e as contagens por coluna do Kanban da Caixa de Entrada.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  STATUS_TO_FLUXO,
  bucketFluxo,
  checklistStatusTexto,
  docStatusTom,
  docStatusVisual,
  normalizarDecisao,
  type FluxoBucket,
} from "@/lib/china/docStatus";
import { FLOW_TONE, bucketForDoc, bucketToTone, iconForBucket, type FlowBucket } from "@/lib/china/flowTones";
import { DocStatusTag } from "@/components/china/DocStatusTag";
import { FlowNode } from "@/components/china/inbox/ChecklistFlow/FlowNode";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
      upsert: async () => ({ error: null }),
    }),
  },
}));

// Importado depois do mock: o hook do chip conversa com o backend.
import {
  ChinaStatusFilterChips,
  FILTER_BUCKETS,
} from "@/components/china/ChinaStatusFilterChips";

/** Réplica do mapa de colunas do MailboxKanban (perspectivas China e Brasil). */
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

function colunaDe(status: string | null, perspectiva: "china" | "brasil") {
  return BUCKET_TO_COLUMN[perspectiva][FLUXO_TO_BUCKET[bucketFluxo(status)]];
}

describe("China — sincronização docStatus × bucketFluxo × UI", () => {
  it("todo status conhecido tem estágio, tom visual e decisão coerentes", () => {
    for (const status of Object.keys(STATUS_TO_FLUXO)) {
      const bucket = bucketFluxo(status);
      const tom = docStatusTom(status);
      const decisao = normalizarDecisao(status);

      expect(bucket).toBe(STATUS_TO_FLUXO[status]);

      if (bucket === "aprovado") {
        expect(tom).toBe("aprovado");
        expect(decisao).toBe("aprovado");
      }
      if (bucket === "devolvido") {
        expect(tom).toBe("rejeitado");
        expect(decisao).toBe("rejeitado");
      }
      if (bucket === "em_analise") {
        expect(tom).toBe("analise");
        expect(decisao).toBe("em_analise");
      }
      if (bucket === "enviado") {
        expect(tom).toBe("enviado");
        expect(decisao).toBe("pendente");
      }
    }
  });

  it("bucketForDoc (fluxo visual) concorda com bucketFluxo para todos os status", () => {
    const esperado: Record<FluxoBucket, FlowBucket> = FLUXO_TO_BUCKET;
    for (const status of Object.keys(STATUS_TO_FLUXO)) {
      expect(bucketForDoc({ doc_status: status })).toBe(esperado[bucketFluxo(status)]);
    }
    expect(bucketForDoc({ doc_status: null })).toBe("nao_criado");
    expect(bucketForDoc(null)).toBe("nao_criado");
  });

  it("etiqueta, chip e nó do fluxo mostram o mesmo rótulo e o mesmo tom", async () => {
    const status = "em_analise";
    const texto = checklistStatusTexto(status);
    const rotulo = `${texto.pt} ${texto.zh}`;
    const badge = docStatusVisual(status).badge;

    const { unmount } = render(<DocStatusTag status={status} />);
    const tag = screen.getByText(rotulo);
    expect(tag.parentElement?.className).toContain(badge.split(" ")[0]);
    unmount();

    render(
      <>
        <FlowNode label="Registro" bucket="em_analise" status={status} />
        <ChinaStatusFilterChips
          counts={{ em_analise: 3 }}
          selected={["em_analise"]}
          onChange={() => {}}
        />
      </>,
    );

    // Mesmo rótulo bilíngue no nó do fluxo e no chip de filtro.
    expect(screen.getAllByText(rotulo).length).toBeGreaterThanOrEqual(2);

    const chip = screen.getByRole("button", { pressed: true });
    expect(chip.className).toContain(badge.split(" ")[0]);
    expect(within(chip).getByText("3")).toBeInTheDocument();
    // Nó do fluxo em análise usa o tom "em andamento".
    expect(bucketToTone("em_analise")).toBe("prog");
  });

  it("chips cobrem exatamente os buckets do fluxo e alternam a seleção", async () => {
    const buckets = FILTER_BUCKETS.map((f) => f.bucket).sort();
    expect(buckets).toEqual(
      (["aprovado", "em_analise", "enviado", "nao_criado", "pendente", "rejeitado"] as FlowBucket[]).sort(),
    );

    const onChange = vi.fn();
    render(
      <ChinaStatusFilterChips
        counts={{ aprovado: 2, rejeitado: 1 }}
        selected={["aprovado"]}
        onChange={onChange}
      />,
    );

    // hideEmpty: só aparecem chips com contagem (+ botão "Limpar").
    expect(screen.getAllByRole("button")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { pressed: false }));
    expect(onChange).toHaveBeenCalledWith(["aprovado", "rejeitado"]);

    await userEvent.click(screen.getByText(/Limpar/));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("contagens por coluna do Kanban seguem o mesmo vocabulário nas duas perspectivas", () => {
    const docs = [
      "aprovado",
      "ciencia",
      "rejeitado",
      "devolvido_china",
      "em_analise",
      "contestado",
      "enviado_brasil",
      "pendente",
      "rascunho",
    ];

    const contar = (perspectiva: "china" | "brasil") =>
      docs.reduce<Record<string, number>>((acc, s) => {
        const col = colunaDe(s, perspectiva);
        acc[col] = (acc[col] || 0) + 1;
        return acc;
      }, {});

    expect(contar("china")).toEqual({
      approved: 2,
      returned: 2,
      in_analysis: 2,
      sent_brazil: 1,
      awaiting_send: 2,
    });

    expect(contar("brasil")).toEqual({
      approved: 2,
      rejected: 2,
      inbox: 5,
    });

    // Total preservado: nenhum documento some entre as visões.
    for (const p of ["china", "brasil"] as const) {
      const total = Object.values(contar(p)).reduce((a, b) => a + b, 0);
      expect(total).toBe(docs.length);
    }
  });

  it("status desconhecido cai em pendente de envio sem quebrar a UI", () => {
    expect(bucketFluxo("status_que_nao_existe")).toBe("pendente_envio");
    expect(bucketForDoc({ doc_status: "status_que_nao_existe" })).toBe("pendente");
    render(<DocStatusTag status="status_que_nao_existe" />);
    expect(screen.getByText(/status_que_nao_existe/)).toBeInTheDocument();
  });
});
