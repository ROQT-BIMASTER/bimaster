import { describe, it, expect } from "vitest";
import { groupBySubmissao } from "../groupMailboxItems";
import type { MailboxItem } from "@/hooks/useChinaMailbox";

function mk(over: Partial<MailboxItem>): MailboxItem {
  return {
    documento_id: over.documento_id ?? `doc-${Math.random()}`,
    tipo_documento: "foto",
    doc_status: "pendente",
    nome_arquivo: "x.jpg",
    arquivo_path: null,
    arquivo_url: null,
    submissao_id: "sub-A",
    produto_codigo: "555",
    produto_nome: "Lipstick",
    numero_ordem: "36",
    submissao_status: "rascunho",
    observacoes_china: null,
    observacoes_brasil: null,
    aprovado_em: null,
    created_at: new Date().toISOString(),
    horas_pendentes: 1,
    is_read: true,
    is_flagged: false,
    is_deleted: false,
    snooze_until: null,
    had_previous_rejection: false,
    ...over,
  };
}

describe("groupBySubmissao", () => {
  it("agrupa documentos da mesma submissão em um único grupo", () => {
    const items = [
      mk({ documento_id: "d1", submissao_id: "sub-A" }),
      mk({ documento_id: "d2", submissao_id: "sub-A" }),
      mk({ documento_id: "d3", submissao_id: "sub-A" }),
    ];
    const groups = groupBySubmissao(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].docs).toHaveLength(3);
  });

  it("worst_status prioriza rejeitado sobre pendente", () => {
    const groups = groupBySubmissao([
      mk({ documento_id: "d1", submissao_id: "sub-A", doc_status: "pendente" }),
      mk({ documento_id: "d2", submissao_id: "sub-A", doc_status: "rejeitado" }),
    ]);
    expect(groups[0].worst_status).toBe("rejeitado");
  });

  it("ordena grupos pela submissão mais recente primeiro", () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString();
    const fresh = new Date().toISOString();
    const groups = groupBySubmissao([
      mk({ documento_id: "d1", submissao_id: "sub-A", created_at: old }),
      mk({ documento_id: "d2", submissao_id: "sub-B", created_at: fresh }),
    ]);
    expect(groups[0].submissao_id).toBe("sub-B");
    expect(groups[1].submissao_id).toBe("sub-A");
  });
});
