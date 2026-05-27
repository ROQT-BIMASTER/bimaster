/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Marker } from "@googlemaps/markerclusterer";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin } from "lucide-react";

interface Prospect {
  id: string;
  nome_empresa: string;
  endereco: string | null;
  tipo_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  cep?: string | null;
  bairro?: string | null;
  municipio: string | null;
  uf?: string | null;
  status: string;
  vendedor_id?: string | null;
  vendedor?: {
    nome: string;
  } | null;
}

interface GeocodedProspect extends Prospect {
  latitude: number;
  longitude: number;
}

const statusColors: Record<string, string> = {
  novo: "#3B82F6",
  em_contato: "#06B6D4",
  proposta_enviada: "#14B8A6",
  negociacao: "#22C55E",
  ganho: "#15803D",
  perdido: "#EF4444",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

const DEFAULT_CENTER = { lat: -14.235, lng: -51.9253 };
const DEFAULT_ZOOM = 4;

export const ProspectMap = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [prospects, setProspects] = useState<GeocodedProspect[]>([]);
  const [selected, setSelected] = useState<GeocodedProspect | null>(null);
  const { toast } = useToast();

  const geocodeAddress = async (
    address: string,
  ): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("geocode-address", {
        body: { address },
      });
      if (error) throw error;
      if (data && data.latitude && data.longitude) return data;
      return null;
    } catch (error) {
      logger.error("Erro ao geocodificar:", error);
      return null;
    }
  };

  const geocodeInBatch = useCallback(
    async (items: Prospect[], batchSize = 10): Promise<GeocodedProspect[]> => {
      const results: GeocodedProspect[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(async (prospect) => {
          let enderecoCompleto = "";
          if (prospect.logradouro && prospect.municipio && prospect.uf) {
            const parts = [
              prospect.tipo_logradouro,
              prospect.logradouro,
              prospect.numero,
              prospect.bairro,
              prospect.municipio,
              prospect.uf,
            ].filter((p) => p && p.trim());
            enderecoCompleto = parts.join(", ") + ", Brasil";
          } else if (prospect.endereco) {
            enderecoCompleto = prospect.endereco + ", Brasil";
          }
          const coords = await geocodeAddress(enderecoCompleto);
          if (coords) {
            return {
              ...prospect,
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          }
          return null;
        });
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter((r): r is GeocodedProspect => r !== null));
        setProgress({
          current: Math.min(i + batchSize, items.length),
          total: items.length,
        });
        if (i + batchSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      return results;
    },
    [],
  );

  // Fetch Google Maps API key
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
        logger.error("Erro ao buscar chave:", error);
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

  // Fetch + geocode prospects
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { data: prospectsRaw, error } = await supabase
          .from("prospects")
          .select(
            "id, nome_empresa, tipo_logradouro, logradouro, numero, bairro, municipio, uf, cep, endereco, status, vendedor_id",
          )
          .limit(50);
        if (error) throw error;

        const vendedorIds =
          prospectsRaw
            ?.map((p) => p.vendedor_id)
            .filter((id): id is string => id !== null && id !== undefined) || [];

        const { data: vendedoresData } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", vendedorIds);

        const vendedoresMap = new globalThis.Map(vendedoresData?.map((v) => [v.id, v] as const) || []);

        const prospectsWithVendedor =
          prospectsRaw?.map((p) => ({
            ...p,
            vendedor: p.vendedor_id ? vendedoresMap.get(p.vendedor_id) : null,
          })) || [];

        const comEndereco = prospectsWithVendedor.filter((p) => {
          if (p.logradouro && p.municipio && p.uf) return true;
          if (p.endereco && p.endereco.trim().length > 5) return true;
          return false;
        });

        if (comEndereco.length === 0) {
          toast({
            title: "Sem dados",
            description: "Nenhum prospect com endereço encontrado.",
          });
          if (isMounted) setLoading(false);
          return;
        }

        setGeocoding(true);
        setProgress({ current: 0, total: comEndereco.length });
        const geocoded = await geocodeInBatch(comEndereco, 10);

        if (!isMounted) return;
        setGeocoding(false);

        if (geocoded.length === 0) {
          toast({
            title: "Erro na geocodificação",
            description: "Não foi possível localizar nenhum endereço.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setProspects(geocoded);
        setLoading(false);
      } catch (error) {
        logger.error("Erro ao carregar mapa:", error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao carregar mapa",
          variant: "destructive",
        });
        if (isMounted) {
          setLoading(false);
          setGeocoding(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [toast, geocodeInBatch]);

  if (loadingKey || loading || geocoding) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium">
            {geocoding
              ? "Geocodificando endereços..."
              : loadingKey
                ? "Carregando mapa..."
                : "Carregando dados..."}
          </p>
          {geocoding && (
            <p className="text-sm text-muted-foreground mt-2">
              {progress.current} de {progress.total} endereços processados
            </p>
          )}
        </div>
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
            Verifique se as APIs "Maps JavaScript API" e "Geocoding API" estão habilitadas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="font-medium">Legenda:</span>
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: statusColors[status] }}
              />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="w-full h-[600px] rounded-lg shadow-lg overflow-hidden">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            <ProspectMapContent
              prospects={prospects}
              selected={selected}
              onSelect={setSelected}
            />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
};

function ProspectMapContent({
  prospects,
  selected,
  onSelect,
}: {
  prospects: GeocodedProspect[];
  selected: GeocodedProspect | null;
  onSelect: (p: GeocodedProspect | null) => void;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());

  // Initialize clusterer
  useEffect(() => {
    if (!map) return;
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: [],
        renderer: {
          render: ({ count, position }) => {
            return new google.maps.marker.AdvancedMarkerElement({
              position,
              content: createClusterElement(count),
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            });
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

  // Fit bounds when prospects arrive
  useEffect(() => {
    if (!map || prospects.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    prospects.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds, 50);
  }, [map, prospects]);

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
      {prospects.map((prospect) => (
        <AdvancedMarker
          key={prospect.id}
          position={{ lat: prospect.latitude, lng: prospect.longitude }}
          onClick={() => onSelect(prospect)}
          ref={(marker) => {
            if (marker) {
              setMarkerRef(marker as unknown as Marker, prospect.id);
            }
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: statusColors[prospect.status] || "#666",
              border: "2px solid white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              cursor: "pointer",
            }}
          />
        </AdvancedMarker>
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.latitude, lng: selected.longitude }}
          onCloseClick={() => onSelect(null)}
          maxWidth={320}
        >
          <ProspectPopup prospect={selected} />
        </InfoWindow>
      )}
    </>
  );
}

function ProspectPopup({ prospect }: { prospect: GeocodedProspect }) {
  const enderecoExibicao = prospect.logradouro
    ? `${prospect.tipo_logradouro || ""} ${prospect.logradouro}, ${prospect.numero || "s/n"} - ${prospect.bairro || ""}, ${prospect.municipio} - ${prospect.uf}`
        .replace(/\s+/g, " ")
        .trim()
    : prospect.endereco;

  return (
    <div style={{ padding: 8 }}>
      <h3 style={{ fontWeight: "bold", marginBottom: 4 }}>{prospect.nome_empresa}</h3>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{enderecoExibicao}</p>
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          background: statusColors[prospect.status],
          color: "white",
          borderRadius: 4,
          fontSize: 11,
        }}
      >
        {statusLabels[prospect.status]}
      </span>
      {prospect.vendedor && (
        <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
          {prospect.vendedor.nome}
        </p>
      )}
    </div>
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
