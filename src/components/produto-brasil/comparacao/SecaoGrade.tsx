import { useQuery } from "@tanstack/react-query";
import { Palette, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ComparacaoSection } from "./ComparacaoSection";
import { DiffBadge, type DiffState } from "./DiffBadge";

interface Props {
  produtoBrasilId: string;
  submissaoChinaId: string | null;
}

interface CorChina {
  id: string;
  cor_nome: string;
  cor_hex: string | null;
  quantidade: number | null;
  codigo_barras_ean: string | null;
}

interface SkuBrasil {
  id: string;
  cor_nome: string | null;
  ean: string | null;
  quantidade: number | null;
}

function useCoresChina(id: string | null) {
  return useQuery({
    queryKey: ["china-cores", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_cores" as any)
        .select("id, cor_nome, cor_hex, quantidade, codigo_barras_ean, ordem")
        .eq("submissao_id", id!)
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as CorChina[];
    },
  });
}

function useSkusBrasil(id: string) {
  return useQuery({
    queryKey: ["produto-brasil-skus-comparacao", id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_skus" as any)
        .select("id, cor_nome, ean, quantidade")
        .eq("produto_brasil_id", id) as any);
      if (error) return [] as SkuBrasil[];
      return (data || []) as SkuBrasil[];
    },
  });
}

export function SecaoGrade({ produtoBrasilId, submissaoChinaId }: Props) {
  const { data: cores = [] } = useCoresChina(submissaoChinaId);
  const { data: skus = [] } = useSkusBrasil(produtoBrasilId);

  const norm = (s: string | null | undefined) =>
    (s || "").trim().toLowerCase();

  const pares = cores.map((c) => {
    const matched = skus.find((s) => norm(s.cor_nome) === norm(c.cor_nome));
    let state: DiffState = "faltando";
    if (matched) {
      state =
        norm(matched.ean) === norm(c.codigo_barras_ean) &&
        (matched.quantidade ?? 0) === (c.quantidade ?? 0)
          ? "igual"
          : "divergente";
    }
    return { cor: c, sku: matched, state };
  });

  // SKUs Brasil sem par na China
  const sobras = skus.filter(
    (s) => !cores.some((c) => norm(c.cor_nome) === norm(s.cor_nome)),
  );

  const divergencias =
    pares.filter((p) => p.state !== "igual").length + sobras.length;

  return (
    <ComparacaoSection
      title="Grade — cores, EAN e quantidade"
      icon={<Palette className="h-4 w-4 text-primary" />}
      countDivergencias={divergencias}
      action={
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`?tab=grade`}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir grade completa
          </Link>
        </Button>
      }
    >
      {cores.length === 0 && skus.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma cor/SKU cadastrada nos dois lados.
        </p>
      ) : (
        <div className="space-y-1.5">
          {pares.map(({ cor, sku, state }) => (
            <div
              key={cor.id}
              className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-1.5 border-b border-border/40 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                {cor.cor_hex && (
                  <div
                    className="w-4 h-4 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: cor.cor_hex }}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{cor.cor_nome}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {cor.quantidade ?? 0} un · EAN {cor.codigo_barras_ean || "—"}
                  </p>
                </div>
              </div>
              <DiffBadge state={state} />
              <div className="text-right min-w-0">
                {sku ? (
                  <>
                    <p className="text-sm font-medium truncate">
                      {sku.cor_nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {sku.quantidade ?? 0} un · EAN {sku.ean || "—"}
                    </p>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    SKU Brasil ausente
                  </span>
                )}
              </div>
            </div>
          ))}

          {sobras.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-1.5 border-b border-border/40 last:border-0"
            >
              <span className="text-xs text-muted-foreground italic">
                Sem par na China
              </span>
              <DiffBadge state="apenas_brasil" />
              <div className="text-right">
                <p className="text-sm font-medium truncate">
                  {s.cor_nome || "—"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {s.quantidade ?? 0} un · EAN {s.ean || "—"}
                </p>
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px] h-5">
              {cores.length} cores na China
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              {skus.length} SKUs Brasil
            </Badge>
          </div>
        </div>
      )}
    </ComparacaoSection>
  );
}
