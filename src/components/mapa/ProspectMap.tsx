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
  vendedor?: {
    nome: string;
  } | null;
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
      console.log(`🌐 Tentando geocodificar: ${address}`);
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address },
      });

      if (error) {
        console.error('❌ Erro na função geocode-address:', error);
        throw error;
      }
      
      if (data && data.latitude && data.longitude) {
        console.log(`✅ Coordenadas obtidas: ${data.latitude}, ${data.longitude}`);
        return data;
      } else {
        console.warn('⚠️ Resposta sem coordenadas:', data);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao geocodificar:', error);
      return null;
    }
  };

  useEffect(() => {
    const initMap = async () => {
      if (!mapContainer.current) return;

      try {
        console.log("🗺️ Iniciando carregamento do mapa...");

        // Buscar token do Mapbox primeiro
        console.log("🔑 Buscando token do Mapbox...");
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
        
        if (tokenError || !tokenData?.token) {
          console.error("❌ Erro ao buscar token:", tokenError);
          toast({
            title: "Configuração necessária",
            description: "Token do Mapbox não configurado. Configure MAPBOX_ACCESS_TOKEN nos secrets.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        console.log("✅ Token do Mapbox obtido com sucesso");

        // Configurar token do Mapbox
        mapboxgl.accessToken = tokenData.token;

        // Buscar prospects com endereços completos
        console.log("📊 Buscando prospects...");
        const { data: prospects, error } = await supabase
          .from("prospects")
          .select(`
            id, 
            nome_empresa, 
            tipo_logradouro,
            logradouro,
            numero,
            bairro,
            municipio,
            uf,
            cep,
            endereco,
            status,
            vendedor:profiles!prospects_vendedor_id_fkey(nome)
          `);

        if (error) {
          console.error("❌ Erro ao buscar prospects:", error);
          throw error;
        }

        console.log(`📋 ${prospects?.length || 0} prospects encontrados`);

        // Filtrar prospects com endereço
        const prospectsComEndereco = prospects?.filter(p => {
          // Preferir endereço estruturado
          if (p.logradouro && p.municipio && p.uf) return true;
          // Fallback para endereço completo
          if (p.endereco && p.endereco.trim().length > 5) return true;
          return false;
        }) || [];

        console.log(`📍 ${prospectsComEndereco.length} prospects com endereço válido`);

        if (prospectsComEndereco.length === 0) {
          toast({
            title: "Sem dados",
            description: "Nenhum prospect com endereço encontrado. Cadastre prospects com endereços completos.",
          });
          setLoading(false);
          return;
        }

        // Geocodificar endereços
        setGeocoding(true);
        setProgress({ current: 0, total: prospectsComEndereco.length });

        const geocodedProspects: GeocodedProspect[] = [];

        for (let i = 0; i < prospectsComEndereco.length; i++) {
          const prospect = prospectsComEndereco[i];
          setProgress({ current: i + 1, total: prospectsComEndereco.length });

          // Construir endereço completo
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

          console.log(`🌐 Geocodificando (${i + 1}/${prospectsComEndereco.length}): ${enderecoCompleto}`);

          const coords = await geocodeAddress(enderecoCompleto);

          if (coords) {
            console.log(`✅ Geocodificado: ${prospect.nome_empresa}`);
            geocodedProspects.push({
              ...prospect,
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
          } else {
            console.warn(`⚠️ Não foi possível geocodificar: ${prospect.nome_empresa}`);
          }

          // Delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        setGeocoding(false);

        console.log(`✅ ${geocodedProspects.length} endereços geocodificados com sucesso`);

        if (geocodedProspects.length === 0) {
          toast({
            title: "Erro na geocodificação",
            description: "Não foi possível localizar nenhum endereço. Verifique se os endereços estão corretos.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Inicializar mapa
        console.log("🗺️ Inicializando mapa com marcadores...");
        const bounds = new mapboxgl.LngLatBounds();
        geocodedProspects.forEach(p => bounds.extend([p.longitude, p.latitude]));

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
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

          const enderecoExibicao = prospect.logradouro 
            ? `${prospect.tipo_logradouro || ''} ${prospect.logradouro}, ${prospect.numero || 's/n'} - ${prospect.bairro || ''}, ${prospect.municipio} - ${prospect.uf}`.replace(/\s+/g, ' ').trim()
            : prospect.endereco;

          const vendedorHTML = prospect.vendedor 
            ? `<p style="font-size: 11px; color: #888; margin-top: 4px;">📋 Responsável: <strong>${prospect.vendedor.nome}</strong></p>` 
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
          description: error instanceof Error ? error.message : "Não foi possível carregar o mapa",
          variant: "destructive",
        });
        setLoading(false);
        setGeocoding(false);
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
