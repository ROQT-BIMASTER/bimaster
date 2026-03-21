import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

export interface Meta {
  id: string;
  periodo: string;
  tipo_meta: string;
  referencia_id: string;
  valor_meta: number;
}

export interface MetaComRealizado extends Meta {
  realizado: number;
  pctAtingimento: number;
  gap: number;
  projecao: number;
  label: string;
}

export function useMetasVendas(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  return useQuery({
    queryKey: ["metas-vendas", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      const periodo = filters.mes
        ? `${filters.ano}-${String(filters.mes).padStart(2, "0")}`
        : null;

      // Fetch metas
      let metaQuery = supabase.from("metas_vendas").select("*");
      if (periodo) metaQuery = metaQuery.eq("periodo", periodo);
      else metaQuery = metaQuery.like("periodo", `${filters.ano}-%`);

      const { data: metas, error: mErr } = await metaQuery;
      if (mErr) throw mErr;

      // Fetch realized from views
      let kpiQuery = supabase.from("vw_dashboard_kpis" as any).select("*").eq("ano", filters.ano);
      if (filters.mes) kpiQuery = kpiQuery.eq("mes", filters.mes);
      if (empresaIds.length > 0) kpiQuery = kpiQuery.in("id_empresa", empresaIds);

      const { data: kpiData, error: kErr } = await kpiQuery;
      if (kErr) throw kErr;

      const rows = ((kpiData as any[]) || []).filter(r => visiveis.has(r.operacao));

      // Aggregate realized by empresa
      const empresaRealizado = new Map<string, number>();
      const supervisorRealizado = new Map<string, number>();
      const vendedorRealizado = new Map<string, number>();

      for (const r of rows) {
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.receita_total) || 0) * mult;
        
        const empKey = String(r.id_empresa);
        empresaRealizado.set(empKey, (empresaRealizado.get(empKey) || 0) + receita);
        
        if (r.supervisor) {
          supervisorRealizado.set(r.supervisor, (supervisorRealizado.get(r.supervisor) || 0) + receita);
        }
        
        const vendKey = String(r.cod_vend);
        vendedorRealizado.set(vendKey, (vendedorRealizado.get(vendKey) || 0) + receita);
      }

      // Calculate projection
      const now = new Date();
      const currentDay = now.getDate();
      const daysInMonth = filters.mes ? new Date(filters.ano, filters.mes, 0).getDate() : 365;
      const isCurrentPeriod = filters.ano === now.getFullYear() && (!filters.mes || filters.mes === now.getMonth() + 1);
      const daysPassed = isCurrentPeriod ? currentDay : daysInMonth;

      const getRealizadoMap = (tipo: string) => {
        switch (tipo) {
          case "empresa": return empresaRealizado;
          case "supervisor": return supervisorRealizado;
          case "vendedor": return vendedorRealizado;
          default: return new Map<string, number>();
        }
      };

      // Fetch labels for references
      const { data: empresas } = await supabase.from("dim_empresa").select("id_empresa,nome_empresa");
      const { data: vendedores } = await supabase.from("dim_vendedor").select("cod_vend,nome_vendedor");
      const empresaNames = new Map((empresas || []).map((e: any) => [String(e.id_empresa), e.nome_empresa]));
      const vendedorNames = new Map((vendedores || []).map((v: any) => [String(v.cod_vend), v.nome_vendedor]));

      const metasComRealizado: MetaComRealizado[] = ((metas as any[]) || []).map(m => {
        const realizadoMap = getRealizadoMap(m.tipo_meta);
        const realizado = realizadoMap.get(m.referencia_id) || 0;
        const pctAtingimento = m.valor_meta > 0 ? (realizado / m.valor_meta) * 100 : 0;
        const gap = m.valor_meta - realizado;
        const mediaDiaria = daysPassed > 0 ? realizado / daysPassed : 0;
        const projecao = mediaDiaria * daysInMonth;
        
        let label = m.referencia_id;
        if (m.tipo_meta === "empresa") label = empresaNames.get(m.referencia_id) || label;
        else if (m.tipo_meta === "vendedor") label = vendedorNames.get(m.referencia_id) || label;
        else if (m.tipo_meta === "supervisor") label = m.referencia_id;

        return { ...m, realizado, pctAtingimento, gap, projecao, label };
      });

      // Historical achievement (last 6 months)
      const historico: { periodo: string; metas: MetaComRealizado[] }[] = [];

      return {
        metas: metasComRealizado,
        empresaMetas: metasComRealizado.filter(m => m.tipo_meta === "empresa"),
        supervisorMetas: metasComRealizado.filter(m => m.tipo_meta === "supervisor"),
        vendedorMetas: metasComRealizado.filter(m => m.tipo_meta === "vendedor"),
      };
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetasCRUD() {
  const queryClient = useQueryClient();

  const upsert = useMutation({
    mutationFn: async (meta: { periodo: string; tipo_meta: string; referencia_id: string; valor_meta: number }) => {
      const { error } = await supabase
        .from("metas_vendas")
        .upsert(meta, { onConflict: "periodo,tipo_meta,referencia_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["metas-vendas"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas_vendas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["metas-vendas"] }),
  });

  return { upsert, remove };
}
