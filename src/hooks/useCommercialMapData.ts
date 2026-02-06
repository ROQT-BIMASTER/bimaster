import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/utils/fetchAllRows";
import { useToast } from "@/hooks/use-toast";

export interface MapCliente {
  id: string;
  nome: string;
  codigo: string;
  cnpj: string | null;
  latitude: number;
  longitude: number;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  data_ultima_compra: string | null;
  valor_ultima_compra: number | null;
  valor_maior_compra: number | null;
  comprador: string | null;
  empresa_id: number | null;
  risco: "ativo" | "atencao" | "alerta" | "critico" | "inativo";
  dias_sem_compra: number;
}

export interface MapProspect {
  id: string;
  nome_empresa: string;
  latitude: number;
  longitude: number;
  municipio: string | null;
  uf: string | null;
  status: string;
  telefone: string | null;
  email: string | null;
  vendedor_nome: string | null;
}

export interface MapFilters {
  empresaId: number | null;
  ufs: string[];
  risco: string[];
  faixaTicket: string | null;
  layers: {
    clientesAtivos: boolean;
    clientesRisco: boolean;
    clientesInativos: boolean;
    prospects: boolean;
    heatmap: boolean;
  };
}

function calcularRisco(diasSemCompra: number): MapCliente["risco"] {
  if (diasSemCompra <= 60) return "ativo";
  if (diasSemCompra <= 120) return "atencao";
  if (diasSemCompra <= 180) return "alerta";
  if (diasSemCompra <= 365) return "critico";
  return "inativo";
}

export function useCommercialMapData(filters: MapFilters) {
  const [clientes, setClientes] = useState<MapCliente[]>([]);
  const [prospects, setProspects] = useState<MapProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocodingStatus, setGeocodingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch ALL clients with coordinates using pagination utility
      const clientesRaw = await fetchAllRows<any>(
        "clientes",
        "id, nome, codigo, cnpj, latitude, longitude, cidade, uf, telefone, celular, email, data_ultima_compra, valor_ultima_compra, valor_maior_compra, comprador, empresa_id",
        (query) => {
          let q = query
            .not("latitude", "is", null)
            .not("longitude", "is", null);

          if (filters.empresaId) {
            q = q.eq("empresa_id", filters.empresaId);
          }
          if (filters.ufs.length > 0) {
            q = q.in("uf", filters.ufs);
          }
          return q;
        }
      );

      const now = new Date();
      let processedClientes = (clientesRaw || []).map((c) => {
        const diasSemCompra = c.data_ultima_compra
          ? Math.floor((now.getTime() - new Date(c.data_ultima_compra).getTime()) / (1000 * 60 * 60 * 24))
          : 9999;
        const risco = calcularRisco(diasSemCompra);
        return { ...c, risco, dias_sem_compra: diasSemCompra } as MapCliente;
      });

      // Filter by risk level
      if (filters.risco.length > 0) {
        processedClientes = processedClientes.filter(c => filters.risco.includes(c.risco));
      }

      // Filter by ticket range
      if (filters.faixaTicket) {
        processedClientes = processedClientes.filter(c => {
          const valor = c.valor_ultima_compra || 0;
          switch (filters.faixaTicket) {
            case "ate_1k": return valor <= 1000;
            case "1k_5k": return valor > 1000 && valor <= 5000;
            case "5k_20k": return valor > 5000 && valor <= 20000;
            case "acima_20k": return valor > 20000;
            default: return true;
          }
        });
      }

      setClientes(processedClientes);

      // Fetch ALL prospects with coordinates using pagination utility
      if (filters.layers.prospects) {
        const prospectsRaw = await fetchAllRows<any>(
          "prospects",
          "id, nome_empresa, latitude, longitude, municipio, uf, status, telefone, email, vendedor_id",
          (query) => {
            let q = query
              .not("latitude", "is", null)
              .not("longitude", "is", null);

            if (filters.ufs.length > 0) {
              q = q.in("uf", filters.ufs);
            }
            return q;
          }
        );

        // Fetch vendedor names for prospects
        const vendedorIds = [...new Set((prospectsRaw || []).map(p => p.vendedor_id).filter(Boolean))];
        let vendedoresMap = new Map<string, string>();
        
        if (vendedorIds.length > 0) {
          const { data: vendedores } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", vendedorIds);
          vendedoresMap = new Map((vendedores || []).map(v => [v.id, v.nome]));
        }

        setProspects((prospectsRaw || []).map(p => ({
          ...p,
          vendedor_nome: p.vendedor_id ? vendedoresMap.get(p.vendedor_id) || null : null,
        })) as MapProspect[]);
      } else {
        setProspects([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do mapa:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados para o mapa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters.empresaId, filters.ufs, filters.risco, filters.faixaTicket, filters.layers.prospects, toast]);

  const triggerGeocoding = useCallback(async (table: "clientes" | "prospects" = "clientes") => {
    try {
      setGeocodingStatus(`Geocodificando ${table}...`);
      const { data, error } = await supabase.functions.invoke("geocode-batch", {
        body: { table, batch_size: 100 },
      });

      if (error) throw error;

      setGeocodingStatus(null);
      toast({
        title: "Geocodificação concluída",
        description: `${data.success} de ${data.processed} registros processados`,
      });

      // Reload data
      fetchData();
    } catch (error) {
      console.error("Erro na geocodificação:", error);
      setGeocodingStatus(null);
      toast({
        title: "Erro na geocodificação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [fetchData, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { clientes, prospects, loading, geocodingStatus, triggerGeocoding, refetch: fetchData };
}
