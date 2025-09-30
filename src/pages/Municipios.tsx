import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Municipio {
  id: string;
  nome: string;
  uf: string;
  regiao: string;
  vendedor_id: string | null;
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
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      setMunicipios(data || []);
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
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Municípios</h2>
          <p className="text-muted-foreground">Municípios atribuídos aos vendedores</p>
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
                      <div className="flex gap-2">
                        <Badge className={regiaoColors[municipio.regiao]}>
                          {municipio.regiao.replace("_", " ")}
                        </Badge>
                        {municipio.vendedor_id && (
                          <Badge variant="secondary">Atribuído</Badge>
                        )}
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
