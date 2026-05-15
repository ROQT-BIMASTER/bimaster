import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, FileText, Lock, Workflow } from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { useCadeiaTabelas, type TabelaCadeiaItem } from "@/hooks/useCadeiaTabelas";
import { simularCascata, validarSelecaoSequencial, type ProdutoEscopo } from "@/lib/fabrica/cascataPricing";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tabelaRaiz: { id: string; nome: string } | null;
  /** Produtos do escopo da submissão (com custo aprovado proposto). */
  produtosEscopo: ProdutoEscopo[];
}

export function AprovacaoCascataDialog({ open, onOpenChange, tabelaRaiz, produtosEscopo }: Props) {
  const qc = useQueryClient();
  const { data: cadeia } = useCadeiaTabelas(tabelaRaiz?.id);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  // limpa seleção ao abrir
  useEffect(() => {
    if (open) setSelecionadas(new Set());
  }, [open, tabelaRaiz?.id]);

  const escopoIds = useMemo(() => produtosEscopo.map((p) => p.produto_id), [produtosEscopo]);

  // Expande kits → unidades via fabrica_produto_grade_itens.
  // Garante que a aprovação em cascata propaga preço para os filhos do kit.
  const { data: kitExpansao } = useQuery({
    queryKey: ["cascata-kit-expansao", tabelaRaiz?.id, escopoIds.join(",")],
    enabled: open && escopoIds.length > 0 && !!tabelaRaiz?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: filhos } = await supabase
        .from("fabrica_produto_grade_itens")
        .select(`
          produto_pai_id,
          quantidade,
          filho:fabrica_produtos!fabrica_produto_grade_itens_produto_filho_id_fkey(id, nome, codigo)
        `)
        .in("produto_pai_id", escopoIds);

      const filhosMap = new Map<string, Array<{ id: string; nome: string; codigo: string; quantidade: number }>>();
      const filhoIds = new Set<string>();
      (filhos || []).forEach((row: any) => {
        if (!row.filho) return;
        const arr = filhosMap.get(row.produto_pai_id) || [];
        arr.push({ id: row.filho.id, nome: row.filho.nome, codigo: row.filho.codigo, quantidade: Number(row.quantidade) || 1 });
        filhosMap.set(row.produto_pai_id, arr);
        filhoIds.add(row.filho.id);
      });

      // Custo raiz dos filhos (preço vigente na tabela raiz). Sem preço → herda do kit pai.
      let precosFilhos: Record<string, number> = {};
      if (filhoIds.size > 0 && tabelaRaiz?.id) {
        const { data: pf } = await supabase
          .from("fabrica_precos_produtos")
          .select("produto_id, preco_final, custo_base")
          .eq("tabela_id", tabelaRaiz.id)
          .eq("ativo", true)
          .in("produto_id", Array.from(filhoIds));
        (pf || []).forEach((p: any) => {
          precosFilhos[p.produto_id] = Number(p.preco_final ?? p.custo_base ?? 0) || 0;
        });
      }
      return { filhosMap, precosFilhos };
    },
  });

  // Escopo final (kits + unidades) usado na simulação E enviado ao RPC.
  const escopoExpandido = useMemo<ProdutoEscopo[]>(() => {
    const out: ProdutoEscopo[] = [...produtosEscopo];
    const seen = new Set(produtosEscopo.map((p) => p.produto_id));
    if (kitExpansao) {
      produtosEscopo.forEach((pai) => {
        const filhos = kitExpansao.filhosMap.get(pai.produto_id) || [];
        filhos.forEach((f) => {
          if (seen.has(f.id)) return;
          seen.add(f.id);
          out.push({
            produto_id: f.id,
            produto_nome: f.nome,
            produto_codigo: f.codigo || "",
            custo_raiz: kitExpansao.precosFilhos[f.id] ?? pai.custo_raiz,
          });
        });
      });
    }
    return out;
  }, [produtosEscopo, kitExpansao]);

  const totalKits = useMemo(() => {
    if (!kitExpansao) return 0;
    return produtosEscopo.filter((p) => (kitExpansao.filhosMap.get(p.produto_id)?.length || 0) > 0).length;
  }, [produtosEscopo, kitExpansao]);

  const dependentes = useMemo(
    () => (cadeia || []).filter((t) => t.nivel > 0),
    [cadeia],
  );

  const invalidos = useMemo(() => {
    if (!cadeia || !tabelaRaiz) return [];
    return validarSelecaoSequencial(selecionadas, cadeia, tabelaRaiz.id);
  }, [selecionadas, cadeia, tabelaRaiz]);

  const cadeiaSimulada = useMemo<TabelaCadeiaItem[]>(() => {
    if (!cadeia || !tabelaRaiz) return [];
    return cadeia.filter((t) => t.id === tabelaRaiz.id || selecionadas.has(t.id));
  }, [cadeia, tabelaRaiz, selecionadas]);

  const linhas = useMemo(
    () => simularCascata(escopoExpandido, cadeiaSimulada),
    [escopoExpandido, cadeiaSimulada],
  );

  const tabelasExibidas = useMemo(
    () => cadeiaSimulada.sort((a, b) => a.nivel - b.nivel),
    [cadeiaSimulada],
  );

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      if (!tabelaRaiz) throw new Error("Tabela raiz ausente");
      const ids = escopoExpandido.map((p) => p.produto_id);
      const { data, error } = await supabase.rpc("rpc_aprovar_cadeia_precos" as any, {
        p_tabela_raiz_id: tabelaRaiz.id,
        p_tabelas_dependentes: Array.from(selecionadas),
        p_produto_ids: ids.length ? ids : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(`Cadeia aprovada (${res?.total ?? "?"} tabela(s), ${escopoExpandido.length} produto(s)).`);
      qc.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      qc.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      qc.invalidateQueries({ queryKey: ["lotes-pendentes-por-tabela"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Falha ao aprovar cadeia: " + (e?.message || e)),
  });

  const exportarExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cascata");
    ws.columns = [
      { header: "Produto", key: "nome", width: 40 },
      { header: "Código", key: "codigo", width: 16 },
      ...tabelasExibidas.map((t) => ({ header: t.nome, key: t.id, width: 18 })),
    ];
    ws.getRow(1).font = { bold: true };
    linhas.forEach((l) => {
      const row: Record<string, any> = { nome: l.produto_nome, codigo: l.produto_codigo };
      tabelasExibidas.forEach((t) => { row[t.id] = Number((l.precos[t.id] || 0).toFixed(4)); });
      ws.addRow(row);
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cascata-${tabelaRaiz?.nome || "tabela"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Simulação de Cascata — ${tabelaRaiz?.nome || ""}`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Produto", "Código", ...tabelasExibidas.map((t) => t.nome)]],
      body: linhas.map((l) => [
        l.produto_nome,
        l.produto_codigo,
        ...tabelasExibidas.map((t) => formatarMoeda(l.precos[t.id] || 0)),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    doc.save(`cascata-${tabelaRaiz?.nome || "tabela"}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Aprovação em Cascata — {tabelaRaiz?.nome}
          </DialogTitle>
          <DialogDescription>
            Selecione as tabelas subsequentes da cadeia para precificar e aprovar
            em um único passo. Tabelas que herdam preço só podem ser marcadas se
            sua tabela base também estiver na seleção.
          </DialogDescription>
        </DialogHeader>

        {!produtosEscopo.length ? (
          <Card>
            <CardContent className="p-3 text-sm text-muted-foreground">
              Nenhum produto resolvido no escopo da submissão. A cascata aprovará
              <strong> todos os produtos vigentes </strong> da tabela base.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{produtosEscopo.length} produto(s) submetido(s)</Badge>
                {totalKits > 0 && (
                  <Badge variant="outline" className="text-primary border-primary">
                    {totalKits} kit(s) → expandindo {escopoExpandido.length - produtosEscopo.length} unidade(s) filha(s)
                  </Badge>
                )}
                <Badge variant="outline">Total cascata: {escopoExpandido.length} item(s)</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                A aprovação propaga preços de cada item submetido (e dos componentes unitários, no caso de kits) por toda a cadeia selecionada.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Seletor da cadeia */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Cadeia subsequente</p>
          {dependentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta tabela não possui descendentes. Use a aprovação simples.
            </p>
          ) : (
            <div className="grid gap-2">
              {dependentes.map((t) => {
                const inv = invalidos.includes(t.id);
                const sel = selecionadas.has(t.id);
                const parentMarcado =
                  !t.tabela_base_id ||
                  t.tabela_base_id === tabelaRaiz?.id ||
                  selecionadas.has(t.tabela_base_id);
                return (
                  <Card key={t.id} className={inv ? "border-destructive" : ""}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Checkbox
                        checked={sel}
                        disabled={!sel && !parentMarcado}
                        onCheckedChange={() => toggle(t.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {t.nome}
                          <Badge variant="outline">{t.codigo}</Badge>
                          <span className="text-xs text-muted-foreground">nível {t.nivel}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Markup: {t.tipo_markup === "percentual" && `+${t.valor_markup}%`}
                          {t.tipo_markup === "multiplicador" && `x${t.valor_markup}`}
                          {t.tipo_markup === "valor_fixo" && `+${formatarMoeda(t.valor_markup)}`}
                        </p>
                      </div>
                      {!sel && !parentMarcado && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" /> Requer tabela base
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Planilha de simulação lado a lado */}
        {tabelasExibidas.length > 1 && linhas.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Pré-visualização (planilha)</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportarExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>
                <Button size="sm" variant="outline" onClick={exportarPDF}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-auto max-h-[40vh]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Produto</th>
                    {tabelasExibidas.map((t) => (
                      <th key={t.id} className="p-2 text-right whitespace-nowrap">{t.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.produto_id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{l.produto_nome}</div>
                        <div className="text-xs text-muted-foreground">{l.produto_codigo}</div>
                      </td>
                      {tabelasExibidas.map((t) => (
                        <td key={t.id} className="p-2 text-right tabular-nums">
                          {formatarMoeda(l.precos[t.id] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={invalidos.length > 0 || aprovarMutation.isPending}
            onClick={() => aprovarMutation.mutate()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {aprovarMutation.isPending
              ? "Aprovando..."
              : `Aprovar raiz + ${selecionadas.size} dependente(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
