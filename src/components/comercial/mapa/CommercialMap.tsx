/// <reference types="google.maps" />
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Marker } from "@googlemaps/markerclusterer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCommercialMapData, type MapFilters, type MapCliente, type MapProspect } from "@/hooks/useCommercialMapData";
import { useMapTeamData } from "@/hooks/useMapTeamData";
import { MapFilters as MapFiltersComponent } from "./MapFilters";
import { MapSidebar } from "./MapSidebar";
import { MapTeamPanel } from "./MapTeamPanel";
import { ClientePopup, ProspectPopup } from "./MapMarkerPopup";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

const RISCO_COLORS: Record<string, string> = {
  ativo: "#22C55E",
  atencao: "#EAB308",
  alerta: "#F97316",
  critico: "#EF4444",
  inativo: "#6B7280",
};

const PROSPECT_COLORS: Record<string, string> = {
  novo: "#3B82F6",
  em_contato: "#06B6D4",
  proposta_enviada: "#14B8A6",
  negociacao: "#8B5CF6",
  ganho: "#15803D",
  perdido: "#DC2626",
};

const DEFAULT_CENTER = { lat: -14.235, lng: -51.9253 }; // Brazil center
const DEFAULT_ZOOM = 4;

export const CommercialMap = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const { toast } = useToast();

  const [filters, setFilters] = useState<MapFilters>({
    empresaId: null,
    ufs: [],
    risco: [],
    faixaTicket: null,
    layers: {
      clientesAtivos: true,
      clientesRisco: true,
      clientesInativos: false,
      prospects: true,
      heatmap: false,
    },
  });

  const { clientes, prospects, loading: dataLoading, geocodingStatus, triggerGeocoding } = useCommercialMapData(filters);
  const { hierarchy, ranking, selfProfile, hasFullVisibility, isLoading: teamLoading } = useMapTeamData();

  const [selectedCliente, setSelectedCliente] = useState<MapCliente | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<MapProspect | null>(null);

  // Fetch empresas for filter
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-mapa"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("empresa_id")
        .not("empresa_id", "is", null);
      const unique = [...new Set((data || []).map(d => d.empresa_id).filter(Boolean))];
      return unique.sort().map(id => ({ id: id as number, nome: `Filial ${id}` }));
    },
  });

  // Fetch API key
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sessão não encontrada");

        const { data, error } = await supabase.functions.invoke("get-google-maps-key", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) throw error;
        if (!data?.key) throw new Error("Chave do Google Maps não configurada");

        setApiKey(data.key);
      } catch (error) {
        console.error("Erro ao buscar chave:", error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Falha ao carregar mapa",
          variant: "destructive",
        });
      } finally {
        setLoadingKey(false);
      }
    };
    fetchKey();
  }, [toast]);

  // Filter clients by active layers
  const visibleClientes = useMemo(() => {
    return clientes.filter(c => {
      if (c.risco === "ativo" && !filters.layers.clientesAtivos) return false;
      if ((c.risco === "atencao" || c.risco === "alerta") && !filters.layers.clientesRisco) return false;
      if ((c.risco === "critico" || c.risco === "inativo") && !filters.layers.clientesInativos) return false;
      return true;
    });
  }, [clientes, filters.layers]);

  if (loadingKey) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando mapa...</p>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">Google Maps não configurado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Verifique se as APIs "Maps JavaScript API" e "Geocoding API" estão habilitadas no Google Cloud Console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[500px]">
        {/* Left sidebar: Team + Filters */}
        <div className="w-[240px] shrink-0 overflow-y-auto space-y-3">
          {/* Painel de Equipe e Ranking - PRIMEIRO */}
          <MapTeamPanel
            hierarchy={hierarchy}
            ranking={ranking}
            selfProfile={selfProfile}
            hasFullVisibility={hasFullVisibility}
            isLoading={teamLoading}
          />

          {/* Filtros do mapa */}
          <MapFiltersComponent filters={filters} onFiltersChange={setFilters} empresas={empresas} />
          
          {/* Geocoding button */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => triggerGeocoding("clientes")}
              disabled={!!geocodingStatus}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${geocodingStatus ? "animate-spin" : ""}`} />
              {geocodingStatus || "Geocodificar Clientes"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => triggerGeocoding("prospects")}
              disabled={!!geocodingStatus}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${geocodingStatus ? "animate-spin" : ""}`} />
              {geocodingStatus || "Geocodificar Prospects"}
            </Button>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-lg overflow-hidden shadow-lg border relative">
          {dataLoading && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando dados...</span>
              </div>
            </div>
          )}
          
          <Map
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            <MapContent
              clientes={visibleClientes}
              prospects={filters.layers.prospects ? prospects : []}
              selectedCliente={selectedCliente}
              selectedProspect={selectedProspect}
              onSelectCliente={setSelectedCliente}
              onSelectProspect={setSelectedProspect}
              showHeatmap={filters.layers.heatmap}
            />
          </Map>
        </div>

        {/* Right sidebar: Analytics */}
        <div className="w-[220px] shrink-0">
          <MapSidebar
            clientes={clientes}
            prospects={prospects}
            visibleClientes={visibleClientes}
            visibleProspects={prospects}
          />
        </div>
      </div>
    </APIProvider>
  );
};

// Internal component that has access to the Map context
function MapContent({
  clientes,
  prospects,
  selectedCliente,
  selectedProspect,
  onSelectCliente,
  onSelectProspect,
  showHeatmap,
}: {
  clientes: MapCliente[];
  prospects: MapProspect[];
  selectedCliente: MapCliente | null;
  selectedProspect: MapProspect | null;
  onSelectCliente: (c: MapCliente | null) => void;
  onSelectProspect: (p: MapProspect | null) => void;
  showHeatmap: boolean;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  // Initialize clusterer
  useEffect(() => {
    if (!map) return;

    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: [],
        renderer: {
          render: ({ count, position }) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              position,
              content: createClusterElement(count),
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            });
            return marker;
          },
        },
      });
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
    };
  }, [map]);

  // Update heatmap
  useEffect(() => {
    if (!map) return;

    if (showHeatmap && clientes.length > 0) {
      const heatmapData = clientes.map(c => 
        new google.maps.LatLng(c.latitude, c.longitude)
      );

      if (heatmapRef.current) {
        heatmapRef.current.setData(heatmapData);
        heatmapRef.current.setMap(map);
      } else {
        heatmapRef.current = new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
          map,
          radius: 30,
          opacity: 0.6,
          gradient: [
            "rgba(0, 0, 0, 0)",
            "rgba(0, 128, 255, 0.4)",
            "rgba(0, 200, 255, 0.6)",
            "rgba(0, 255, 128, 0.7)",
            "rgba(255, 255, 0, 0.8)",
            "rgba(255, 128, 0, 0.9)",
            "rgba(255, 0, 0, 1)",
          ],
        });
      }
    } else {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
      }
    }

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
      }
    };
  }, [map, showHeatmap, clientes]);

  const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
    if (marker) {
      markersRef.current.set(key, marker);
    } else {
      markersRef.current.delete(key);
    }
    
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers([...markersRef.current.values()]);
    }
  }, []);

  return (
    <>
      {/* Client markers */}
      {clientes.map((cliente) => (
        <AdvancedMarker
          key={`c-${cliente.id}`}
          position={{ lat: cliente.latitude, lng: cliente.longitude }}
          onClick={() => {
            onSelectProspect(null);
            onSelectCliente(cliente);
          }}
          ref={(marker) => {
            if (marker) {
              setMarkerRef(marker as unknown as Marker, `c-${cliente.id}`);
            }
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: RISCO_COLORS[cliente.risco] || "#666",
              border: "2px solid white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              cursor: "pointer",
            }}
          />
        </AdvancedMarker>
      ))}

      {/* Prospect markers */}
      {prospects.map((prospect) => (
        <AdvancedMarker
          key={`p-${prospect.id}`}
          position={{ lat: prospect.latitude, lng: prospect.longitude }}
          onClick={() => {
            onSelectCliente(null);
            onSelectProspect(prospect);
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "4px",
              backgroundColor: PROSPECT_COLORS[prospect.status] || "#3B82F6",
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              cursor: "pointer",
              transform: "rotate(45deg)",
            }}
          />
        </AdvancedMarker>
      ))}

      {/* InfoWindows */}
      {selectedCliente && (
        <InfoWindow
          position={{ lat: selectedCliente.latitude, lng: selectedCliente.longitude }}
          onCloseClick={() => onSelectCliente(null)}
          maxWidth={350}
        >
          <ClientePopup cliente={selectedCliente} onClose={() => onSelectCliente(null)} />
        </InfoWindow>
      )}

      {selectedProspect && (
        <InfoWindow
          position={{ lat: selectedProspect.latitude, lng: selectedProspect.longitude }}
          onCloseClick={() => onSelectProspect(null)}
          maxWidth={320}
        >
          <ProspectPopup prospect={selectedProspect} onClose={() => onSelectProspect(null)} />
        </InfoWindow>
      )}
    </>
  );
}

function createClusterElement(count: number): HTMLElement {
  const el = document.createElement("div");
  const size = Math.min(60, 30 + Math.log2(count) * 8);
  
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontWeight = "bold";
  el.style.fontSize = "12px";
  el.style.color = "white";
  el.style.cursor = "pointer";
  
  if (count < 50) {
    el.style.backgroundColor = "rgba(34, 197, 94, 0.8)";
    el.style.border = "3px solid rgba(34, 197, 94, 1)";
  } else if (count < 200) {
    el.style.backgroundColor = "rgba(59, 130, 246, 0.8)";
    el.style.border = "3px solid rgba(59, 130, 246, 1)";
  } else {
    el.style.backgroundColor = "rgba(239, 68, 68, 0.8)";
    el.style.border = "3px solid rgba(239, 68, 68, 1)";
  }
  
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
  el.textContent = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  
  return el;
}
