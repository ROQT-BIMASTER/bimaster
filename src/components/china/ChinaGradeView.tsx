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

function normalizeGrupo(g?: string): string {
  if (!g) return "—";
  return String(g).trim();
}

function ItemCard({ item }: { item: GradeViewItem }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md">
      {item.cor_hex ? (
        <div
          className="h-4 w-4 rounded-full border border-border shrink-0"
          style={{ backgroundColor: item.cor_hex }}
        />
      ) : (
        <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-xs font-semibold text-foreground truncate">{item.cor_nome}</span>
        <span className="text-[10px] text-muted-foreground truncate">
          {normalizeGrupo(item.grupo)} · {item.quantidade} pcs
        </span>
      </div>
    </div>
  );
}

function GrupoColumn({ titulo, items }: { titulo: string; items: GradeViewItem[] }) {
  const total = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <Badge variant="outline" className="text-[11px] font-semibold">
          {titulo}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {items.length} cores · {total.toLocaleString()} pcs
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item, i) => (
          <ItemCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

export function ChinaGradeView({ items, compact = false }: ChinaGradeViewProps) {
  if (!items || items.length === 0) return null;

  // Agrupa por grupo
  const grupos = new Map<string, GradeViewItem[]>();
  items.forEach((item) => {
    const key = normalizeGrupo(item.grupo);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(item);
  });

  // Ordena chaves naturalmente (G1, G2, G3...)
  const sortedKeys = Array.from(grupos.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  const totalQty = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);

  if (compact) {
    return (
      <div className={`grid gap-3 ${sortedKeys.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {sortedKeys.map((key) => (
          <GrupoColumn key={key} titulo={key} items={grupos.get(key)!} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <BilingualLabel pt="Grade de Cores" cn="颜色网格" size="md" />
        <span className="text-xs text-muted-foreground">
          Total 总计: <strong>{totalQty.toLocaleString()}</strong>
        </span>
      </div>
      <div className={`grid gap-4 ${sortedKeys.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {sortedKeys.map((key) => (
          <div key={key} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b">
              <span className="text-xs font-bold text-foreground">Grupo 组 {key}</span>
              <span className="text-[10px] text-muted-foreground">
                {grupos.get(key)!.length} cores ·{" "}
                {grupos.get(key)!.reduce((s, i) => s + (i.quantidade || 0), 0).toLocaleString()} pcs
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-[10px] text-muted-foreground">
                  <th className="px-3 py-1.5 text-left">Cor 颜色</th>
                  {grupos.get(key)!.some((i) => i.cor_numero) && (
                    <th className="px-3 py-1.5 text-left">Nº</th>
                  )}
                  {grupos.get(key)!.some((i) => i.codigo_produto) && (
                    <th className="px-3 py-1.5 text-left">Código</th>
                  )}
                  {grupos.get(key)!.some((i) => i.codigo_barras_ean) && (
                    <th className="px-3 py-1.5 text-left">EAN</th>
                  )}
                  <th className="px-3 py-1.5 text-right">Qtd 数量</th>
                </tr>
              </thead>
              <tbody>
                {grupos.get(key)!.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {item.cor_hex ? (
                          <div
                            className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                            style={{ backgroundColor: item.cor_hex }}
                          />
                        ) : (
                          <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-foreground text-xs">{item.cor_nome}</span>
                      </div>
                    </td>
                    {grupos.get(key)!.some((x) => x.cor_numero) && (
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {item.cor_numero || "—"}
                      </td>
                    )}
                    {grupos.get(key)!.some((x) => x.codigo_produto) && (
                      <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">
                        {item.codigo_produto || "—"}
                      </td>
                    )}
                    {grupos.get(key)!.some((x) => x.codigo_barras_ean) && (
                      <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">
                        {item.codigo_barras_ean || "—"}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right text-xs font-bold">
                      {item.quantidade.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
