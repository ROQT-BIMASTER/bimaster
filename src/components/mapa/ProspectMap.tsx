import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Prospect {
  id: string;
  nome_empresa: string;
  endereco: string | null;
  municipio: string | null;
  status: string;
}

interface GeocodedProspect extends Prospect {
  latitude: number;
  longitude: number;
}

const statusColors: Record<string, string> = {
  novo: "#3B82F6", // blue
  em_contato: "#06B6D4", // cyan
  proposta_enviada: "#14B8A6", // teal
  negociacao: "#22C55E", // green
  ganho: "#15803D", // dark green
  perdido: "#EF4444", // red
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const ProspectMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  useEffect(() => {
    const initMap = async () => {
      if (!mapContainer.current) return;

      try {
        // Buscar prospects
        const { data: prospects, error } = await supabase
          .from("prospects")
          .select("id, nome_empresa, endereco, status")
          .not("endereco", "is", null);

        if (error) throw error;

        if (!prospects || prospects.length === 0) {
          toast({
            title: "Sem dados",
            description: "Nenhum prospect com endereço encontrado",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Geocodificar endereços
        setGeocoding(true);
        setProgress({ current: 0, total: prospects.length });

        const geocodedProspects: GeocodedProspect[] = [];

        for (let i = 0; i < prospects.length; i++) {
          const prospect = prospects[i];
          setProgress({ current: i + 1, total: prospects.length });

          const coords = await geocodeAddress(prospect.endereco || '');

          if (coords) {
            geocodedProspects.push({
              ...prospect,
              municipio: null,
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
          }

          // Delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        setGeocoding(false);

        if (geocodedProspects.length === 0) {
          toast({
            title: "Erro",
            description: "Não foi possível geocodificar nenhum endereço",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Inicializar mapa
        const { data: secretData } = await supabase.functions.invoke('geocode-address', {
          body: { address: 'test' },
        });

        // Usar token público (deve ser configurado)
        mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

        const bounds = new mapboxgl.LngLatBounds();
        geocodedProspects.forEach(p => bounds.extend([p.longitude, p.latitude]));

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/light-v11",
          bounds: bounds,
          fitBoundsOptions: { padding: 50 },
        });

        map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

        // Adicionar marcadores
        geocodedProspects.forEach((prospect) => {
          const el = document.createElement("div");
          el.className = "marker";
          el.style.backgroundColor = statusColors[prospect.status] || "#666";
          el.style.width = "20px";
          el.style.height = "20px";
          el.style.borderRadius = "50%";
          el.style.border = "2px solid white";
          el.style.cursor = "pointer";
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">${prospect.nome_empresa}</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${prospect.endereco}</p>
              <span style="display: inline-block; padding: 2px 8px; background: ${statusColors[prospect.status]}; color: white; border-radius: 4px; font-size: 11px;">
                ${statusLabels[prospect.status]}
              </span>
            </div>
          `);

          new mapboxgl.Marker(el)
            .setLngLat([prospect.longitude, prospect.latitude])
            .setPopup(popup)
            .addTo(map.current!);
        });

        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar mapa:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o mapa",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    initMap();

    return () => {
      map.current?.remove();
    };
  }, [toast]);

  if (loading || geocoding) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium">
            {geocoding ? "Geocodificando endereços..." : "Carregando mapa..."}
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
      
      <div ref={mapContainer} className="w-full h-[600px] rounded-lg shadow-lg" />
    </div>
  );
};
