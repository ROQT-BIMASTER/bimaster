import { useQuery } from "@tanstack/react-query";
import { DollarSign, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { ComparacaoSection } from "./ComparacaoSection";
import { ComparacaoRow } from "./ComparacaoRow";
import { computeDiff } from "./DiffBadge";

interface Props {
  produtoBrasilId: string;
  submissaoChinaId: string | null;
  custoUnitarioChina: number | null;
}

interface CustoBR {
  custo_nf: number | null;
  custo_servico: number | null;
  custo_condicao: number | null;
  impostos_percentual: number | null;
  frete_valor: number | null;
}

function useCustoBrasil(id: string) {
  return useQuery({
    queryKey: ["produto-brasil-custos-comparacao", id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_custos" as any)
        .select("custo_nf, custo_servico, custo_condicao, impostos_percentual, frete_valor")
        .eq("produto_brasil_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (error) return null;
      return (data || null) as CustoBR | null;
    },
  });
}

const fmt = (v: number | null | undefined) =>
  v == null ? "" : formatCurrency(Number(v));

export function SecaoCustosFiscais({
  produtoBrasilId,
  custoUnitarioChina,
}: Props) {
  const { data: custo } = useCustoBrasil(produtoBrasilId);

  const rows = [
    {
      label: "FOB unitário (China)",
      china: fmt(custoUnitarioChina),
      brasil: fmt(custo?.custo_nf),
      cRaw: custoUnitarioChina,
      bRaw: custo?.custo_nf,
    },
    {
      label: "Frete / Serviço",
      china: "",
      brasil: fmt(custo?.frete_valor || custo?.custo_servico),
      cRaw: null,
      bRaw: custo?.frete_valor || custo?.custo_servico,
    },
    {
      label: "Impostos (II/IPI/ICMS/PIS/COFINS)",
      china: "",
      brasil:
        custo?.impostos_percentual != null
          ? `${Number(custo.impostos_percentual).toFixed(2)} %`
          : "",
      cRaw: null,
      bRaw: custo?.impostos_percentual,
    },
    {
      label: "Condição comercial",
      china: "",
      brasil: fmt(custo?.custo_condicao),
      cRaw: null,
      bRaw: custo?.custo_condicao,
    },
  ];

  const divergencias = rows.filter(
    (r) => computeDiff(r.cRaw, r.bRaw) === "faltando",
  ).length;

  return (
    <ComparacaoSection
      title="Custos fiscais Brasil"
      icon={<DollarSign className="h-4 w-4 text-primary" />}
      countDivergencias={divergencias}
      action={
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`?tab=custos`}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir ficha de custo
          </Link>
        </Button>
      }
    >
      {rows.map((r) => (
        <ComparacaoRow
          key={r.label}
          label={r.label}
          china={r.china}
          brasil={r.brasil}
          chinaRaw={r.cRaw}
          brasilRaw={r.bRaw}
        />
      ))}
      <p className="text-[10px] text-muted-foreground italic pt-2">
        FOB → CIF, II, IPI, ICMS, PIS e COFINS são compostos no Brasil. A China
        fornece apenas o FOB de origem.
      </p>
    </ComparacaoSection>
  );
}
