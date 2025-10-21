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
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const { toast } = useToast();

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo(prev => [...prev, msg]);
  };

  useEffect(() => {
    let isMounted = true;
    
    const initMap = async () => {
      try {
        addDebug("1. Iniciando...");
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMounted) {
          addDebug("2. Componente desmontado");
          return;
        }
        
        addDebug("3. Buscando sessão...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error("Sem sessão");
        }
        
        addDebug("4. Chamando get-mapbox-token...");
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-mapbox-token', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        
        addDebug(`5. Resposta: ${tokenData ? 'OK' : 'ERRO'}`);
        
        if (tokenError) throw new Error(tokenError.message);
        if (!tokenData?.token) throw new Error("Sem token");
        
        addDebug("6. Token OK, buscando prospects...");
        
        const { data: prospects, error: prospectsError } = await supabase
          .from("prospects")
          .select("id, nome_empresa, municipio")
          .limit(5);
        
        if (prospectsError) throw new Error(prospectsError.message);
        
        addDebug(`7. ${prospects?.length || 0} prospects encontrados`);
        
        setLoading(false);
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        addDebug(`ERRO: ${errorMsg}`);
        setError(errorMsg);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar mapa</h3>
        <p className="text-sm mb-4">{error}</p>
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Debug:</p>
          {debugInfo.map((info, i) => (
            <p key={i}>{info}</p>
          ))}
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-lg font-medium">Carregando mapa...</p>
          </div>
        </Card>
        
        {debugInfo.length > 0 && (
          <Card className="p-4">
            <p className="text-sm font-semibold mb-2">Debug Info:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              {debugInfo.map((info, i) => (
                <p key={i}>{info}</p>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-green-600">Mapa carregado com sucesso!</h3>
      <div className="text-xs text-muted-foreground mt-4">
        {debugInfo.map((info, i) => (
          <p key={i}>{info}</p>
        ))}
      </div>
    </Card>
  );
};

