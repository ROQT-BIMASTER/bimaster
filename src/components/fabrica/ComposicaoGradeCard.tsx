import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Barcode, Package } from "lucide-react";

interface GradeFilho {
  id: string;
  nome: string;
  codigo: string;
  codigo_barras_ean: string | null;
  quantidade: number;
}

interface ComposicaoGradeCardProps {
  produtoId: string;
  compact?: boolean;
}

export function ComposicaoGradeCard({ produtoId, compact = false }: ComposicaoGradeCardProps) {
  const [itens, setItens] = useState<GradeFilho[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("id, quantidade, ordem, produto_filho:fabrica_produtos!produto_filho_id(nome, codigo, codigo_barras_ean)")
        .eq("produto_pai_id", produtoId)
        .order("ordem");

      if (data) {
        setItens(
          data.map((d: any) => ({
            id: d.id,
            nome: d.produto_filho?.nome || "",
            codigo: d.produto_filho?.codigo || "",
            codigo_barras_ean: d.produto_filho?.codigo_barras_ean || null,
            quantidade: d.quantidade,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, [produtoId]);

  if (loading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (itens.length === 0) return null;

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);

  if (compact) {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Layers className="h-2.5 w-2.5" />
        Kit · {totalItens} un.
      </Badge>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        <Layers className="h-3 w-3 inline mr-1" />
        Composição de Grade ({itens.length} variantes)
      </h4>
      <div className="space-y-1">
        {itens.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
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
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">Total de itens no display</span>
        <span className="text-xs font-semibold">{totalItens} un.</span>
      </div>
    </div>
  );
}
