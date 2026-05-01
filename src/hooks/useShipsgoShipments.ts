import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShipsgoShipment {
  id: string;
  embarque_id: string | null;
  ordem_compra_id: string | null;
  shipsgo_id: string | null;
  container_number: string | null;
  bl_number: string | null;
  booking_number: string | null;
  carrier_code: string | null;
  carrier_name: string | null;
  status: string;
  pol_name: string | null;
  pol_country: string | null;
  pod_name: string | null;
  pod_country: string | null;
  eta_original: string | null;
  eta_atual: string | null;
  ata: string | null;
  data_embarque: string | null;
  dias_atraso: number | null;
  last_event_at: string | null;
  last_event_description: string | null;
  last_event_location: string | null;
  geojson: any;
  created_at: string;
  updated_at: string;
}

export interface ShipsgoShipmentEvent {
  id: string;
  shipment_id: string;
  event_type: string | null;
  event_code: string | null;
  description: string | null;
  location_name: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  event_at: string;
  is_actual: boolean;
}

export interface ShipsgoFilters {
  search?: string;
  status?: string;
  carrier?: string;
  atraso_min?: number;
  ordem_compra_id?: string;
  embarque_id?: string;
}

export function useShipsgoShipments(filters: ShipsgoFilters = {}) {
  return useQuery({
    queryKey: ["shipsgo-shipments", filters],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("shipsgo_shipments" as any)
        .select("*")
        .order("eta_atual", { ascending: true, nullsFirst: false });

      if (filters.status) q = q.eq("status", filters.status);
      if (filters.carrier) q = q.eq("carrier_code", filters.carrier);
      if (filters.ordem_compra_id) q = q.eq("ordem_compra_id", filters.ordem_compra_id);
      if (filters.embarque_id) q = q.eq("embarque_id", filters.embarque_id);
      if (typeof filters.atraso_min === "number") q = q.gte("dias_atraso", filters.atraso_min);
      if (filters.search?.trim()) {
        const s = filters.search.trim();
        q = q.or(
          `container_number.ilike.%${s}%,bl_number.ilike.%${s}%,booking_number.ilike.%${s}%`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ShipsgoShipment[];
    },
  });
}

export function useShipsgoShipment(id?: string) {
  return useQuery({
    queryKey: ["shipsgo-shipment", id],
    enabled: !!id,
    staleTime: 15_000,
    queryFn: async () => {
      const [{ data: ship, error: e1 }, { data: events, error: e2 }] =
        await Promise.all([
          supabase.from("shipsgo_shipments" as any).select("*").eq("id", id!).maybeSingle(),
          supabase
            .from("shipsgo_shipment_events" as any)
            .select("*")
            .eq("shipment_id", id!)
            .order("event_at", { ascending: false }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        shipment: ship as unknown as ShipsgoShipment | null,
        events: (events || []) as unknown as ShipsgoShipmentEvent[],
      };
    },
  });
}

export function useCriarShipsgoTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      embarque_id?: string;
      ordem_compra_id?: string;
      container_number?: string;
      bl_number?: string;
      booking_number?: string;
      carrier_code?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("shipsgo-create-shipment", {
        body: input,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipsgo-shipments"] });
      toast.success("Rastreamento iniciado 跟踪已启动");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar rastreamento"),
  });
}

export function useSyncShipsgoShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shipment_id: string) => {
      const { data, error } = await supabase.functions.invoke("shipsgo-sync-shipment", {
        body: { shipment_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      return data;
    },
    onSuccess: (_d, shipment_id) => {
      qc.invalidateQueries({ queryKey: ["shipsgo-shipments"] });
      qc.invalidateQueries({ queryKey: ["shipsgo-shipment", shipment_id] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });
}
