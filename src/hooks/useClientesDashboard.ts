import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

interface ClienteDetail {
  cod_cliente: number;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  cidade: string | null;
  vendedor: string | null;
  supervisor: string | null;
  id_empresa: number | null;
  ultima_compra: string | null;
  dias_sem_compra: number;
  receita: number;
  qtde_pedidos: number;
  ticket_medio: number;
}

interface ClienteKPIs {
  totalCadastrados: number;
  clientesAtivos: number;
  clientesInativos: number;
  taxaRecompra: number;
  churnRate: number;
}

interface ParetoItem {
  cod_cliente: number;
  nome: string;
  receita: number;
  pctAcumulado: number;
}

interface UFItem {
  uf: string;
  qtdClientes: number;
  receita: number;
}

interface FaixaItem {
  faixa: string;
  min: number;
  max: number;
  quantidade: number;
  valorTotal: number;
}

export function useClientesDashboard(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  const query = useQuery({
    queryKey: ["clientes-dashboard", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      // 1. Fetch all clients
      let clienteQuery = supabase.from("clientes").select("codigo,nome,cnpj,uf,cidade,cod_vend,vendedor,supervisor,id_empresa");
      if (empresaIds.length > 0) clienteQuery = clienteQuery.in("id_empresa", empresaIds);
      const { data: clientes, error: cErr } = await clienteQuery;
      if (cErr) throw cErr;

      // 2. Fetch sales data for the period from the KPI view
      let salesQuery = supabase
        .from("vw_dashboard_kpis" as any)
        .select("cod_vend,receita_total,qtde_pedidos,clientes_ativos,operacao")
        .eq("ano", filters.ano);
      if (filters.mes) salesQuery = salesQuery.eq("mes", filters.mes);
      if (empresaIds.length > 0) salesQuery = salesQuery.in("id_empresa", empresaIds);
      if (filters.supervisor) salesQuery = salesQuery.eq("supervisor", filters.supervisor);
      if (filters.uf) salesQuery = salesQuery.eq("uf", filters.uf);

      // 3. Fetch per-client sales from vendas_union directly
      let perClientQuery = supabase
        .from("vendas_union" as any)
        .select("cod_cliente,pedido,data,operacao,venda,preco_venda,quantidade")
        .eq("data::text", "") // placeholder - we'll build real filter
      
      // Actually, let's use a proper date range filter
      const startDate = filters.mes
        ? `${filters.ano}-${String(filters.mes).padStart(2, "0")}-01`
        : `${filters.ano}-01-01`;
      const endDate = filters.mes
        ? new Date(filters.ano, filters.mes, 0).toISOString().split("T")[0]
        : `${filters.ano}-12-31`;

      let vendasQuery = supabase
        .from("vendas_union")
        .select("cod_cliente,pedido,data,operacao,venda,preco_venda,quantidade,vendedor,supervisor,id_empresa,uf")
        .gte("data", startDate)
        .lte("data", endDate);
      if (empresaIds.length > 0) vendasQuery = vendasQuery.in("id_empresa", empresaIds);
      if (filters.supervisor) vendasQuery = vendasQuery.eq("supervisor", filters.supervisor);
      if (filters.uf) vendasQuery = vendasQuery.eq("uf", filters.uf);

      // Fetch in batches
      const allVendas: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        let q = supabase
          .from("vendas_union")
          .select("cod_cliente,pedido,data,operacao,venda,preco_venda,quantidade,vendedor,supervisor,id_empresa,uf")
          .gte("data", startDate)
          .lte("data", endDate)
          .range(offset, offset + batchSize - 1);
        if (empresaIds.length > 0) q = q.in("id_empresa", empresaIds);
        if (filters.supervisor) q = q.eq("supervisor", filters.supervisor);
        if (filters.uf) q = q.eq("uf", filters.uf);
        
        const { data: batch, error: bErr } = await q;
        if (bErr) throw bErr;
        if (batch && batch.length > 0) {
          allVendas.push(...batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Filter by operation visibility
      const filteredVendas = allVendas.filter(v => visiveis.has(v.operacao));

      // Aggregate per client
      const clienteMap = new Map<number, {
        receita: number;
        pedidos: Set<number>;
        ultimaCompra: string | null;
        meses: Set<string>;
        vendedor: string | null;
        supervisor: string | null;
        id_empresa: number | null;
        uf: string | null;
      }>();

      for (const v of filteredVendas) {
        const cod = v.cod_cliente;
        if (!cod) continue;
        const mult = multipliers.get(v.operacao) ?? 1;
        const valor = (v.venda ?? (v.preco_venda && v.quantidade ? v.preco_venda * v.quantidade : 0)) * mult;

        if (!clienteMap.has(cod)) {
          clienteMap.set(cod, { receita: 0, pedidos: new Set(), ultimaCompra: null, meses: new Set(), vendedor: v.vendedor, supervisor: v.supervisor, id_empresa: v.id_empresa, uf: v.uf });
        }
        const entry = clienteMap.get(cod)!;
        entry.receita += valor;
        if (v.pedido) entry.pedidos.add(v.pedido);
        if (v.data) {
          const mesKey = v.data.substring(0, 7);
          entry.meses.add(mesKey);
          if (!entry.ultimaCompra || v.data > entry.ultimaCompra) entry.ultimaCompra = v.data;
        }
      }

      const today = new Date();
      const clientesList = (clientes || []) as any[];
      const totalCadastrados = clientesList.length;

      // Build detail list
      const clientesDetail: ClienteDetail[] = clientesList.map((c: any) => {
        const cod = parseInt(c.codigo) || 0;
        const vendaData = clienteMap.get(cod);
        const ultimaCompra = vendaData?.ultimaCompra || null;
        const diasSemCompra = ultimaCompra ? Math.floor((today.getTime() - new Date(ultimaCompra).getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const receita = vendaData?.receita || 0;
        const qtdePedidos = vendaData?.pedidos.size || 0;

        return {
          cod_cliente: cod,
          nome: c.nome || "",
          cnpj: c.cnpj,
          uf: c.uf || vendaData?.uf || null,
          cidade: c.cidade,
          vendedor: c.vendedor || vendaData?.vendedor || null,
          supervisor: c.supervisor || vendaData?.supervisor || null,
          id_empresa: c.id_empresa || vendaData?.id_empresa || null,
          ultima_compra: ultimaCompra,
          dias_sem_compra: diasSemCompra,
          receita,
          qtde_pedidos: qtdePedidos,
          ticket_medio: qtdePedidos > 0 ? receita / qtdePedidos : 0,
        };
      });

      // KPIs
      const clientesAtivos = clientesDetail.filter(c => c.receita > 0).length;
      const clientesInativos = totalCadastrados - clientesAtivos;
      const clientesComRecompra = Array.from(clienteMap.values()).filter(c => c.meses.size >= 2).length;
      const taxaRecompra = clientesAtivos > 0 ? (clientesComRecompra / clientesAtivos) * 100 : 0;
      const churnRate = totalCadastrados > 0 ? (clientesInativos / totalCadastrados) * 100 : 0;

      const kpis: ClienteKPIs = { totalCadastrados, clientesAtivos, clientesInativos, taxaRecompra, churnRate };

      // Pareto data
      const sortedByReceita = clientesDetail.filter(c => c.receita > 0).sort((a, b) => b.receita - a.receita);
      const totalReceita = sortedByReceita.reduce((s, c) => s + c.receita, 0);
      let acumulado = 0;
      const paretoData: ParetoItem[] = sortedByReceita.slice(0, 50).map(c => {
        acumulado += c.receita;
        return { cod_cliente: c.cod_cliente, nome: c.nome, receita: c.receita, pctAcumulado: totalReceita > 0 ? (acumulado / totalReceita) * 100 : 0 };
      });

      // UF data
      const ufMap = new Map<string, { qtd: number; receita: number }>();
      for (const c of clientesDetail) {
        const uf = c.uf || "N/D";
        if (!ufMap.has(uf)) ufMap.set(uf, { qtd: 0, receita: 0 });
        ufMap.get(uf)!.qtd++;
        ufMap.get(uf)!.receita += c.receita;
      }
      const ufData: UFItem[] = [...ufMap.entries()].map(([uf, v]) => ({ uf, qtdClientes: v.qtd, receita: v.receita })).sort((a, b) => b.receita - a.receita);

      // Faixa data
      const faixas = [
        { faixa: "Até R$1k", min: 0, max: 1000 },
        { faixa: "R$1k - R$5k", min: 1000, max: 5000 },
        { faixa: "R$5k - R$10k", min: 5000, max: 10000 },
        { faixa: "R$10k - R$50k", min: 10000, max: 50000 },
        { faixa: "R$50k+", min: 50000, max: Infinity },
      ];
      const faixaData: FaixaItem[] = faixas.map(f => {
        const inFaixa = clientesDetail.filter(c => c.receita > 0 && c.receita >= f.min && c.receita < f.max);
        return { ...f, quantidade: inFaixa.length, valorTotal: inFaixa.reduce((s, c) => s + c.receita, 0) };
      });

      return { kpis, clientesDetail: clientesDetail.sort((a, b) => b.receita - a.receita), paretoData, ufData, faixaData };
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });

  return {
    kpis: query.data?.kpis || null,
    clientesDetail: query.data?.clientesDetail || [],
    paretoData: query.data?.paretoData || [],
    ufData: query.data?.ufData || [],
    faixaData: query.data?.faixaData || [],
    isLoading: query.isLoading,
  };
}
