import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NovoMunicipioDialog } from "@/components/admin/NovoMunicipioDialog";
import { AtribuirProspectsDialog } from "@/components/admin/AtribuirProspectsDialog";
import { AtribuirMunicipiosMassaDialog } from "@/components/admin/AtribuirMunicipiosMassaDialog";

interface Municipio {
  id: string;
  nome: string;
  uf: string;
  regiao: string;
  vendedor_id: string | null;
  vendedor_nome?: string;
  total_prospects?: number;
}

const regiaoColors: Record<string, string> = {
  norte: "bg-blue-500",
  nordeste: "bg-yellow-500",
  centro_oeste: "bg-orange-500",
  sudeste: "bg-green-500",
  sul: "bg-purple-500",
};

const Municipios = () => {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchMunicipios();
  }, []);

  const fetchMunicipios = async () => {
    try {
      const { data, error } = await supabase
        .from("municipios")
        .select(`
          *,
          profiles!municipios_vendedor_id_fkey (nome),
          prospects (count)
        `)
        .order("nome", { ascending: true });

      if (error) throw error;
      
      const municipiosFormatados = (data || []).map(m => ({
        id: m.id,
        nome: m.nome,
        uf: m.uf,
        regiao: m.regiao,
        vendedor_id: m.vendedor_id,
        vendedor_nome: (m.profiles as any)?.nome,
        total_prospects: m.prospects?.[0]?.count || 0
      }));
      
      setMunicipios(municipiosFormatados);
    } catch (error) {
      console.error("Erro ao carregar municípios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os municípios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMunicipios = municipios.filter((municipio) =>
    municipio.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    municipio.uf.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Municípios</h2>
            <p className="text-muted-foreground">Municípios atribuídos aos vendedores</p>
          </div>
          <div className="flex gap-2">
            <AtribuirMunicipiosMassaDialog onSuccess={fetchMunicipios} />
            <AtribuirProspectsDialog />
            <NovoMunicipioDialog onSuccess={fetchMunicipios} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por município ou UF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando municípios...</div>
            ) : filteredMunicipios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum município encontrado
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMunicipios.map((municipio) => (
                  <Card key={municipio.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{municipio.nome}</h3>
                        <Badge variant="outline">{municipio.uf}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Badge className={regiaoColors[municipio.regiao]}>
                            {municipio.regiao.replace("_", " ")}
                          </Badge>
                          {municipio.vendedor_id ? (
                            <Badge variant="default">Coberto</Badge>
                          ) : (
                            <Badge variant="destructive">Descoberto</Badge>
                          )}
                        </div>
                        {municipio.vendedor_nome && (
                          <p className="text-sm text-muted-foreground">
                            Vendedor: {municipio.vendedor_nome}
                          </p>
                        )}
                        <p className="text-sm font-medium">
                          {municipio.total_prospects || 0} {municipio.total_prospects === 1 ? 'prospect' : 'prospects'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Municipios;
