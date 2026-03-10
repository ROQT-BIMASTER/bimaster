import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "./BilingualLabel";
import { Palette } from "lucide-react";

interface GradeViewItem {
  cor_nome: string;
  cor_hex?: string;
  cor_numero?: string;
  codigo_produto?: string;
  codigo_barras_ean?: string;
  quantidade: number;
  grupo?: string;
}

interface ChinaGradeViewProps {
  items: GradeViewItem[];
  compact?: boolean;
}

export function ChinaGradeView({ items, compact = false }: ChinaGradeViewProps) {
  if (!items || items.length === 0) return null;

  const totalQty = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-card border rounded-md">
            {item.cor_hex ? (
              <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: item.cor_hex }} />
            ) : (
              <Palette className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs font-medium text-foreground">{item.cor_nome}</span>
            <span className="text-[10px] text-muted-foreground">{item.quantidade}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <BilingualLabel pt="Grade de Cores" cn="颜色网格" size="md" />
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left">Cor 颜色</th>
              {items.some((i) => i.cor_numero) && <th className="px-3 py-2 text-left">Nº</th>}
              {items.some((i) => i.codigo_produto) && <th className="px-3 py-2 text-left">Código 编码</th>}
              {items.some((i) => i.codigo_barras_ean) && <th className="px-3 py-2 text-left">EAN</th>}
              <th className="px-3 py-2 text-right">Qtd 数量</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.cor_hex ? (
                      <div className="h-4 w-4 rounded-full border border-border shrink-0" style={{ backgroundColor: item.cor_hex }} />
                    ) : (
                      <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-foreground text-xs">{item.cor_nome}</span>
                  </div>
                </td>
                {items.some((x) => x.cor_numero) && (
                  <td className="px-3 py-2 text-xs text-muted-foreground">{item.cor_numero || "—"}</td>
                )}
                {items.some((x) => x.codigo_produto) && (
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{item.codigo_produto || "—"}</td>
                )}
                {items.some((x) => x.codigo_barras_ean) && (
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{item.codigo_barras_ean || "—"}</td>
                )}
                <td className="px-3 py-2 text-right text-xs font-bold">{item.quantidade.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-muted-foreground">
                Total 总计
              </td>
              <td className="px-3 py-2 text-right text-xs font-bold">{totalQty.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
