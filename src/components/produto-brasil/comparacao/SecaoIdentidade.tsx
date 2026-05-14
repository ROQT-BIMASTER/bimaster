import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { ComparacaoSection } from "./ComparacaoSection";
import { ComparacaoRow } from "./ComparacaoRow";
import { computeDiff } from "./DiffBadge";

interface Props {
  produto: ProdutoBrasil;
}

function useSubmissao(id: string | null) {
  return useQuery({
    queryKey: ["china-submissao-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", id!)
        .single() as any);
      if (error) throw error;
      return data as any;
    },
  });
}

export function SecaoIdentidade({ produto }: Props) {
  const update = useUpdateProdutoBrasil();
  const { data: sub } = useSubmissao(produto.submissao_china_id);

  const chinaNome = sub?.produto_nome || produto.china_nome || "";
  const chinaCodigo = sub?.produto_codigo || produto.china_codigo || "";

  const rows = [
    {
      label: "Nome do Produto",
      china: chinaNome,
      brasil: produto.nome_brasil,
      copy: () =>
        update.mutate({ id: produto.id, nome_brasil: chinaNome } as any),
    },
    {
      label: "Código",
      china: chinaCodigo,
      brasil: produto.codigo_brasil,
      copy: () =>
        update.mutate({ id: produto.id, codigo_brasil: chinaCodigo } as any),
    },
    {
      label: "Categoria",
      china: produto.china_categoria,
      brasil: produto.categoria_brasil,
      copy: () =>
        update.mutate({
          id: produto.id,
          categoria_brasil: produto.china_categoria,
        } as any),
    },
    {
      label: "Descrição",
      china: produto.china_descricao,
      brasil: produto.descricao_brasil,
      copy: () =>
        update.mutate({
          id: produto.id,
          descricao_brasil: produto.china_descricao,
        } as any),
    },
    {
      label: "EAN Unidade",
      china: sub?.ean_unidade || produto.china_ean,
      brasil: produto.ean_unitario,
      copy: () =>
        update.mutate({
          id: produto.id,
          ean_unitario: sub?.ean_unidade || produto.china_ean,
        } as any),
    },
    {
      label: "EAN Display",
      china: sub?.ean_display,
      brasil: produto.ean_display,
      copy: () =>
        update.mutate({ id: produto.id, ean_display: sub?.ean_display } as any),
    },
    {
      label: "EAN Caixa Master",
      china: sub?.ean_caixa_master,
      brasil: produto.ean_caixa_master,
      copy: () =>
        update.mutate({
          id: produto.id,
          ean_caixa_master: sub?.ean_caixa_master,
        } as any),
    },
    {
      label: "Peso Líquido (g)",
      china: sub?.peso_liquido_g,
      brasil: produto.peso_liquido,
    },
    {
      label: "Peso Bruto (g)",
      china: sub?.peso_bruto_g,
      brasil: produto.peso_bruto,
    },
  ];

  const divergencias = rows.filter(
    (r) => computeDiff(r.china, r.brasil) === "divergente" || computeDiff(r.china, r.brasil) === "faltando",
  ).length;

  const copyAll = () => {
    update.mutate(
      {
        id: produto.id,
        nome_brasil: produto.nome_brasil || chinaNome,
        codigo_brasil: produto.codigo_brasil || chinaCodigo,
        categoria_brasil: produto.categoria_brasil || produto.china_categoria,
        descricao_brasil: produto.descricao_brasil || produto.china_descricao,
        ean_unitario:
          produto.ean_unitario || sub?.ean_unidade || produto.china_ean,
        ean_display: produto.ean_display || sub?.ean_display,
        ean_caixa_master: produto.ean_caixa_master || sub?.ean_caixa_master,
      } as any,
      { onSuccess: () => toast.success("Campos faltantes preenchidos a partir da China") },
    );
  };

  return (
    <ComparacaoSection
      title="Identidade"
      icon={<Tag className="h-4 w-4 text-primary" />}
      countDivergencias={divergencias}
      action={
        divergencias > 0 ? (
          <Button size="sm" variant="outline" onClick={copyAll} className="h-7 text-xs">
            <Copy className="h-3 w-3 mr-1" />
            Copiar faltantes
          </Button>
        ) : null
      }
    >
      {rows.map((r) => (
        <ComparacaoRow
          key={r.label}
          label={r.label}
          china={r.china ?? ""}
          brasil={r.brasil ?? ""}
          onCopiar={r.copy}
        />
      ))}
    </ComparacaoSection>
  );
}
