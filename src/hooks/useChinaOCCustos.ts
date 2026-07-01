import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OCCustosForm {
  valor_fob_usd: number;
  valor_frete_usd: number;
  valor_seguro_usd: number;
  taxa_cambio: number;
  ii_perc: number;
  ipi_perc: number;
  icms_perc: number;
  pis_cofins_perc: number;
  custos_extras_brl: number;
}

export function calcularLandedCost(form: OCCustosForm, qtyTotal: number) {
  const fobBrl = form.valor_fob_usd * form.taxa_cambio;
  const freteBrl = form.valor_frete_usd * form.taxa_cambio;
  const seguroBrl = form.valor_seguro_usd * form.taxa_cambio;
  const baseImpostos = fobBrl + freteBrl + seguroBrl;
  const ii = baseImpostos * (form.ii_perc / 100);
  const baseIpi = baseImpostos + ii;
  const ipi = baseIpi * (form.ipi_perc / 100);
  const basePisCofins = baseIpi + ipi;
  const pisCofins = basePisCofins * (form.pis_cofins_perc / 100);
  const baseIcms = basePisCofins + pisCofins;
  const icms = baseIcms / (1 - form.icms_perc / 100) - baseIcms;

  const total = baseImpostos + ii + ipi + pisCofins + icms + form.custos_extras_brl;
  const unitario = qtyTotal > 0 ? total / qtyTotal : 0;
  return {
    fobBrl,
    freteBrl,
    seguroBrl,
    ii,
    ipi,
    icms,
    pisCofins,
    custosExtrasBrl: form.custos_extras_brl,
    total,
    unitario,
  };
}

export function useOCCustos(ordemId?: string) {
  return useQuery({
    queryKey: ["china-oc-custos", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_oc_custos" as any)
        .select("*")
        .eq("ordem_compra_id", ordemId!)
        .maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
  });
}

export function useSalvarOCCustos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ordem_compra_id: string; form: OCCustosForm; qtyTotal: number }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const r = calcularLandedCost(payload.form, payload.qtyTotal);
      const { error } = await supabase.from("china_oc_custos" as any).upsert(
        {
          ordem_compra_id: payload.ordem_compra_id,
          ...payload.form,
          custo_total_brl: r.total,
          custo_unitario_por_item: { unitario: r.unitario, qty: payload.qtyTotal } as any,
          calculado_em: new Date().toISOString(),
          calculado_por: user?.id,
        } as any,
        { onConflict: "ordem_compra_id" },
      );
      if (error) throw error;
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-oc-custos"] });
      toast.success("Custo de aquisição salvo");
    },
    onError: (e: any) => toast.error(toFriendlyPermissionMessage(e, "Erro ao salvar custos")),
  });
}
