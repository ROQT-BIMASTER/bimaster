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
      
      if (data && data.latitude && data.longitude) {
        return data;
      }
      return null;
    } catch (error) {
      console.error('Erro ao geocodificar:', error);
      return null;
    }
  };

  const geocodeInBatch = async (
    prospects: Prospect[], 
    batchSize: number = 10
  ): Promise<GeocodedProspect[]> => {
    const results: GeocodedProspect[] = [];
    
    for (let i = 0; i < prospects.length; i += batchSize) {
      const batch = prospects.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (prospect) => {
        let enderecoCompleto = '';
        if (prospect.logradouro && prospect.municipio && prospect.uf) {
          const parts = [
            prospect.tipo_logradouro,
            prospect.logradouro,
            prospect.numero,
            prospect.bairro,
            prospect.municipio,
            prospect.uf
          ].filter(p => p && p.trim());
          enderecoCompleto = parts.join(', ') + ', Brasil';
        } else if (prospect.endereco) {
          enderecoCompleto = prospect.endereco + ', Brasil';
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
      
      setProgress({ current: Math.min(i + batchSize, prospects.length), total: prospects.length });
      
      if (i + batchSize < prospects.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  };

  useEffect(() => {
    let isMounted = true;
    
    const initMap = async () => {
      console.log("🗺️ Iniciando mapa...");
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (!isMounted || !mapContainer.current) {
        console.log("❌ Container não montado");
        return;
      }

      try {
        console.log("🔐 Buscando sessão...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          console.log("❌ Sessão não encontrada");
          throw new Error("Sessão não encontrada");
        }
        
        console.log("🔑 Buscando token Mapbox...");
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        
        if (tokenError) {
          console.error("❌ Erro ao buscar token:", tokenError);
          throw new Error(`Erro ao buscar token: ${tokenError.message}`);
        }
        if (!tokenData?.token) {
          console.error("❌ Token não configurado");
          throw new Error("Token do Mapbox não configurado");
        }

        console.log("✅ Token Mapbox obtido");
        mapboxgl.accessToken = tokenData.token;

        console.log("📍 Buscando prospects...");
        const { data: prospects, error } = await supabase
          .from("prospects")
          .select("id, nome_empresa, tipo_logradouro, logradouro, numero, bairro, municipio, uf, cep, endereco, status, vendedor_id")
          .limit(100);

        if (error) {
          console.error("❌ Erro ao buscar prospects:", error);
          throw error;
        }
        
        console.log(`✅ ${prospects?.length || 0} prospects encontrados`);

        const vendedorIds = prospects
          ?.map(p => p.vendedor_id)
          .filter((id): id is string => id !== null && id !== undefined) || [];

        const { data: vendedoresData } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", vendedorIds);

        const vendedoresMap = new Map(vendedoresData?.map(v => [v.id, v]) || []);

        const prospectsWithVendedor = prospects?.map(p => ({
          ...p,
          vendedor: p.vendedor_id ? vendedoresMap.get(p.vendedor_id) : null
        })) || [];

        const prospectsComEndereco = prospectsWithVendedor.filter(p => {
          if (p.logradouro && p.municipio && p.uf) return true;
          if (p.endereco && p.endereco.trim().length > 5) return true;
          return false;
        });

        console.log(`📍 ${prospectsComEndereco.length} prospects com endereço`);

        if (prospectsComEndereco.length === 0) {
          console.log("❌ Nenhum prospect com endereço");
          toast({
            title: "Sem dados",
            description: "Nenhum prospect com endereço encontrado.",
          });
          setLoading(false);
          return;
        }

        const MAX_PROSPECTS = 100;
        const prospectsParaGeocodificar = prospectsComEndereco.slice(0, MAX_PROSPECTS);
        
        if (prospectsComEndereco.length > MAX_PROSPECTS) {
          toast({
            title: "Limite de exibição",
            description: `Exibindo ${MAX_PROSPECTS} de ${prospectsComEndereco.length} prospects.`,
          });
        }

        console.log("🌍 Iniciando geocodificação...");
        setGeocoding(true);
        setProgress({ current: 0, total: prospectsParaGeocodificar.length });

        const geocodedProspects = await geocodeInBatch(prospectsParaGeocodificar, 10);
        
        console.log(`✅ ${geocodedProspects.length} prospects geocodificados`);
        setGeocoding(false);

        if (geocodedProspects.length === 0) {
          console.log("❌ Nenhum endereço geocodificado");
          toast({
            title: "Erro na geocodificação",
            description: "Não foi possível localizar nenhum endereço.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        console.log("🗺️ Criando mapa Mapbox...");
        const bounds = new mapboxgl.LngLatBounds();
        geocodedProspects.forEach(p => bounds.extend([p.longitude, p.latitude]));

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: "mapbox://styles/mapbox/light-v11",
          bounds: bounds,
          fitBoundsOptions: { padding: 50 },
        });

        map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
        console.log("✅ Mapa criado, adicionando marcadores...");

        geocodedProspects.forEach((prospect) => {
          const el = document.createElement("div");
          el.style.backgroundColor = statusColors[prospect.status] || "#666";
          el.style.width = "20px";
          el.style.height = "20px";
          el.style.borderRadius = "50%";
          el.style.border = "2px solid white";
          el.style.cursor = "pointer";
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

          const enderecoExibicao = prospect.logradouro 
            ? `${prospect.tipo_logradouro || ''} ${prospect.logradouro}, ${prospect.numero || 's/n'} - ${prospect.bairro || ''}, ${prospect.municipio} - ${prospect.uf}`.replace(/\s+/g, ' ').trim()
            : prospect.endereco;

          const vendedorHTML = prospect.vendedor 
            ? `<p style="font-size: 11px; color: #888; margin-top: 4px;">📋 ${prospect.vendedor.nome}</p>` 
            : '';

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">${prospect.nome_empresa}</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${enderecoExibicao}</p>
              <span style="display: inline-block; padding: 2px 8px; background: ${statusColors[prospect.status]}; color: white; border-radius: 4px; font-size: 11px;">
                ${statusLabels[prospect.status]}
              </span>
              ${vendedorHTML}
            </div>
          `);

          new mapboxgl.Marker(el)
            .setLngLat([prospect.longitude, prospect.latitude])
            .setPopup(popup)
            .addTo(map.current!);
        });

        console.log("✅ Mapa carregado com sucesso!");
        setLoading(false);
      } catch (error) {
        console.error("❌ Erro ao carregar mapa:", error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao carregar mapa",
          variant: "destructive",
        });
        setLoading(false);
        setGeocoding(false);
      }
    };

    initMap();

    return () => {
      isMounted = false;
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
