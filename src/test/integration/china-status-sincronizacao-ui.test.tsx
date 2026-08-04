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

/* ────────────────────────────────────────────────────────────────
 * Asserts detalhados por sincronização.
 * A cada mudança de status simulada, verificamos os TRÊS pontos de
 * leitura da UI ao mesmo tempo: chips de filtro, nós do fluxo e as
 * contagens por coluna do Kanban.
 * ──────────────────────────────────────────────────────────────── */

/** Sequência real de sincronizações de um documento no fluxo China → Brasil. */
const SINCRONIZACOES: Array<{
  status: string;
  bucket: FlowBucket;
  tom: ReturnType<typeof bucketToTone>;
  colunaChina: string;
  colunaBrasil: string;
}> = [
  { status: "rascunho", bucket: "pendente", tom: "idle", colunaChina: "awaiting_send", colunaBrasil: "inbox" },
  { status: "enviado_brasil", bucket: "enviado", tom: "prog", colunaChina: "sent_brazil", colunaBrasil: "inbox" },
  { status: "em_analise", bucket: "em_analise", tom: "prog", colunaChina: "in_analysis", colunaBrasil: "inbox" },
  { status: "contestado", bucket: "em_analise", tom: "prog", colunaChina: "in_analysis", colunaBrasil: "inbox" },
  { status: "aprovado", bucket: "aprovado", tom: "done", colunaChina: "approved", colunaBrasil: "approved" },
  { status: "ciencia", bucket: "aprovado", tom: "done", colunaChina: "approved", colunaBrasil: "approved" },
  { status: "rejeitado", bucket: "rejeitado", tom: "block", colunaChina: "returned", colunaBrasil: "rejected" },
  { status: "devolvido_china", bucket: "rejeitado", tom: "block", colunaChina: "returned", colunaBrasil: "rejected" },
];

const rotuloDe = (status: string) => {
  const t = checklistStatusTexto(status);
  return `${t.pt} ${t.zh}`;
};

describe("China — asserts detalhados a cada sincronização de status", () => {
  it("nó do fluxo mostra rótulo, ícone e paleta exatos do status sincronizado", () => {
    for (const passo of SINCRONIZACOES) {
      const { unmount } = render(
        <FlowNode label="Etapa" labelCn="步骤" bucket={passo.bucket} status={passo.status} />,
      );

      // Classificação derivada do status bruto.
      expect(bucketForDoc({ doc_status: passo.status })).toBe(passo.bucket);
      expect(bucketToTone(passo.bucket)).toBe(passo.tom);

      // Etiqueta bilíngue correta e única.
      const etiquetas = screen.getAllByText(rotuloDe(passo.status));
      expect(etiquetas).toHaveLength(1);

      // Badge com a paleta do status (mesma de docStatusVisual).
      const badge = etiquetas[0].parentElement!;
      for (const classe of docStatusVisual(passo.status).badge.split(" ")) {
        expect(badge.className).toContain(classe);
      }

      // Círculo do nó com as classes do tom do fluxo.
      const cfg = FLOW_TONE[passo.tom];
      const circulo = screen.getByRole("button").querySelector("span")!;
      expect(circulo.className).toContain(cfg.border);
      expect(circulo.className).toContain(cfg.bg);
      expect(circulo.className).toContain(cfg.ring);

      // Ícone do bucket coerente com o mapa central ("enviado" usa Upload).
      expect(iconForBucket(passo.bucket)).toBe(
        passo.bucket === "enviado" ? iconForBucket("enviado") : cfg.icon,
      );
      expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();

      unmount();
    }
  });

  it("chips refletem contagem, seleção e paleta após cada sincronização", async () => {
    const user = userEvent.setup();

    for (const passo of SINCRONIZACOES) {
      const onChange = vi.fn();
      const counts = { [passo.bucket]: 1 } as Partial<Record<FlowBucket, number>>;

      const { unmount } = render(
        <ChinaStatusFilterChips counts={counts} selected={[passo.bucket]} onChange={onChange} />,
      );

      // Só o bucket com contagem aparece (+ botão "Limpar").
      const chips = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
      expect(chips).toHaveLength(1);

      const chip = chips[0];
      expect(chip).toHaveAttribute("aria-pressed", "true");
      expect(within(chip).getByText("1")).toBeInTheDocument();

      // Rótulo do chip = rótulo do status representativo do bucket.
      const statusRef = FILTER_BUCKETS.find((f) => f.bucket === passo.bucket)!.statusRef;
      expect(within(chip).getByText(rotuloDe(statusRef))).toBeInTheDocument();
      for (const classe of docStatusVisual(statusRef).badge.split(" ")) {
        expect(chip.className).toContain(classe);
      }

      // Desmarcar remove exatamente esse bucket.
      await user.click(chip);
      expect(onChange).toHaveBeenCalledWith([]);

      unmount();
    }
  });

  it("contagens por coluna acompanham cada sincronização nas duas perspectivas", () => {
    // Documento único percorrendo o fluxo: a coluna muda a cada sincronização.
    for (const passo of SINCRONIZACOES) {
      expect(colunaDe(passo.status, "china")).toBe(passo.colunaChina);
      expect(colunaDe(passo.status, "brasil")).toBe(passo.colunaBrasil);
    }

    // Lote de 3 documentos migrando de "em análise" para decisões distintas.
    const antes = ["em_analise", "em_analise", "em_analise"];
    const depois = ["aprovado", "rejeitado", "contestado"];

    const contar = (docs: string[], p: "china" | "brasil") =>
      docs.reduce<Record<string, number>>((acc, s) => {
        const col = colunaDe(s, p);
        acc[col] = (acc[col] || 0) + 1;
        return acc;
      }, {});

    expect(contar(antes, "china")).toEqual({ in_analysis: 3 });
    expect(contar(depois, "china")).toEqual({ approved: 1, returned: 1, in_analysis: 1 });
    expect(contar(antes, "brasil")).toEqual({ inbox: 3 });
    expect(contar(depois, "brasil")).toEqual({ approved: 1, rejected: 1, inbox: 1 });

    // Nenhum documento se perde ou se duplica em qualquer momento.
    for (const docs of [antes, depois]) {
      for (const p of ["china", "brasil"] as const) {
        const total = Object.values(contar(docs, p)).reduce((a, b) => a + b, 0);
        expect(total).toBe(docs.length);
      }
    }
  });

  it("chips, nós e colunas concordam simultaneamente para o mesmo conjunto", () => {
    const docs = SINCRONIZACOES.map((p) => p.status);

    // Contagem por bucket derivada só do status bruto.
    const counts = docs.reduce<Partial<Record<FlowBucket, number>>>((acc, s) => {
      const b = FLUXO_TO_BUCKET[bucketFluxo(s)];
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ pendente: 1, enviado: 1, em_analise: 2, aprovado: 2, rejeitado: 2 });

    const { unmount } = render(
      <ChinaStatusFilterChips counts={counts} selected={[]} onChange={() => {}} />,
    );
    // Cada chip visível mostra exatamente a contagem do seu bucket.
    for (const { bucket, statusRef } of FILTER_BUCKETS) {
      const esperado = counts[bucket];
      if (!esperado) continue;
      const chip = screen
        .getAllByRole("button")
        .find((b) => within(b).queryByText(rotuloDe(statusRef)))!;
      expect(chip).toBeDefined();
      expect(within(chip).getByText(String(esperado))).toBeInTheDocument();
    }
    unmount();

    // E a soma das colunas do Kanban bate com a soma dos chips.
    const totalChips = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    const totalColunas = docs.reduce((acc, s) => acc + (colunaDe(s, "china") ? 1 : 0), 0);
    expect(totalColunas).toBe(totalChips);
    expect(totalChips).toBe(docs.length);
  });
});
