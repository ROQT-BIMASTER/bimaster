import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { ComparacaoSection } from "./ComparacaoSection";
import { DiffBadge } from "./DiffBadge";

interface Props {
  produtoBrasilId: string;
}

interface PrecoSugerido {
  id: string;
  canal: string | null;
  regiao: string | null;
  preco_sugerido: number | null;
}

function usePrecosSugeridos(id: string) {
  return useQuery({
    queryKey: ["produto-brasil-precos-sugeridos-comparacao", id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_precos_sugeridos" as any)
        .select("id, canal, regiao, preco_sugerido")
        .eq("produto_brasil_id", id) as any);
      if (error) return [] as PrecoSugerido[];
      return (data || []) as PrecoSugerido[];
    },
  });
}

export function SecaoPrecosSugeridos({ produtoBrasilId }: Props) {
  const { data: precos = [] } = usePrecosSugeridos(produtoBrasilId);

  return (
    <ComparacaoSection
      title="Preços sugeridos por canal e região"
      icon={<TrendingUp className="h-4 w-4 text-primary" />}
      countDivergencias={precos.length === 0 ? 1 : 0}
      action={
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`?tab=custos`}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Definir preços
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start py-2">
        <div className="text-sm text-muted-foreground italic bg-muted/40 rounded px-2 py-3 text-center">
          Não aplicável — preço de canal é definido no Brasil.
        </div>
        <div className="pt-3">
          <DiffBadge state={precos.length === 0 ? "faltando" : "apenas_brasil"} />
        </div>
        <div>
          {precos.length === 0 ? (
            <div className="text-sm text-muted-foreground italic bg-card border border-destructive/40 ring-2 ring-destructive/40 rounded px-2 py-3 text-center">
              Nenhum preço sugerido cadastrado.
            </div>
          ) : (
            <div className="space-y-1">
              {precos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 bg-card border border-border rounded px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      {p.canal || "Canal"} · {p.regiao || "BR"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {p.preco_sugerido != null
                      ? formatCurrency(Number(p.preco_sugerido))
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ComparacaoSection>
  );
}
