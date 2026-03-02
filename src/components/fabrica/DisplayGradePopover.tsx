import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Barcode, Package, Printer, Eye } from "lucide-react";

interface GradeFilho {
  id: string;
  nome: string;
  codigo: string;
  codigo_barras_ean: string | null;
  foto_url: string | null;
  quantidade: number;
  cor_hex: string | null;
  cor_numero: string | null;
}

interface DisplayGradePopoverProps {
  produtoId: string;
  produtoNome?: string;
  produtoCodigo?: string;
}

export function DisplayGradePopover({ produtoId, produtoNome, produtoCodigo }: DisplayGradePopoverProps) {
  const [itens, setItens] = useState<GradeFilho[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("id, quantidade, ordem, cor_numero, cor_hex, produto_filho:fabrica_produtos!produto_filho_id(nome, codigo, codigo_barras_ean, foto_url)")
        .eq("produto_pai_id", produtoId)
        .order("ordem");

      if (data) {
        setItens(
          data.map((d: any) => ({
            id: d.id,
            nome: d.produto_filho?.nome || "",
            codigo: d.produto_filho?.codigo || "",
            codigo_barras_ean: d.produto_filho?.codigo_barras_ean || null,
            foto_url: d.produto_filho?.foto_url || null,
            quantidade: d.quantidade,
            cor_hex: d.cor_hex || null,
            cor_numero: d.cor_numero || null,
          }))
        );
      }
      setLoading(false);
    };
    fetchData();
  }, [open, produtoId]);

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Grade - ${produtoNome || "Display"}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; color: #1a1a1a; }
          h2 { margin: 0 0 4px; font-size: 18px; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #333; font-weight: 600; }
          td { padding: 6px; border-bottom: 1px solid #e5e5e5; }
          .mono { font-family: monospace; }
          .right { text-align: right; }
          .total-row { font-weight: 700; border-top: 2px solid #333; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h2>${produtoNome || "Display"}</h2>
        <div class="subtitle">${produtoCodigo || ""} · ${itens.length} variantes · ${totalItens} unidades</div>
        <table>
          <thead>
            <tr><th>#</th><th>Cor</th><th>Código</th><th>Produto</th><th>EAN</th><th class="right">Qtd</th></tr>
          </thead>
          <tbody>
            ${itens.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.cor_hex ? `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${item.cor_hex};border:1px solid #ccc;vertical-align:middle;margin-right:4px"></span>` : ""}${item.cor_numero || "—"}</td>
                <td class="mono">${item.codigo}</td>
                <td>${item.nome}</td>
                <td class="mono">${item.codigo_barras_ean || "—"}</td>
                <td class="right">${item.quantidade}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="5">Total</td>
              <td class="right">${totalItens}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <Eye className="h-3 w-3" />
          Grade
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div ref={printRef}>
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-semibold flex items-center gap-1">
              <Layers className="h-3 w-3" /> Composição de Grade
            </span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={handlePrint} disabled={loading || itens.length === 0}>
              <Printer className="h-3 w-3" /> Imprimir
            </Button>
          </div>

          <div className="p-2 max-h-60 overflow-y-auto space-y-1">
            {loading ? (
              <>
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </>
            ) : itens.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum item na grade</p>
            ) : (
              itens.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.cor_hex && (
                      <span
                        className="h-4 w-4 rounded-sm border border-border shrink-0"
                        style={{ backgroundColor: item.cor_hex }}
                        title={item.cor_numero || item.cor_hex}
                      />
                    )}
                    {item.foto_url ? (
                      <img src={item.foto_url} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
                      {item.codigo}
                    </Badge>
                    <span className="truncate">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.codigo_barras_ean && (
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                        <Barcode className="h-2.5 w-2.5" />
                        {item.codigo_barras_ean}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[9px] py-0">
                      ×{item.quantidade}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          {!loading && itens.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t text-xs">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{totalItens} un.</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
