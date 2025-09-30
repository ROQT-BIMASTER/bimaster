import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Municipio {
  id: string;
  nome: string;
  uf: string;
  vendedor_id: string | null;
  vendedor_nome?: string;
}

export const MunicipioAtribuicao = () => {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("");
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar vendedores
      const { data: vendData, error: vendError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("tipo_usuario", ["vendedor", "supervisor"]);

      if (vendError) throw vendError;
      setVendedores(vendData || []);

      // Buscar municípios com vendedores
      const { data: munData, error: munError } = await supabase
        .from("municipios")
        .select(`
          id,
          nome,
          uf,
          vendedor_id,
          profiles!municipios_vendedor_id_fkey (nome)
        `)
        .order("nome");

      if (munError) throw munError;
      
      const municipiosFormatados = (munData || []).map(m => ({
        id: m.id,
        nome: m.nome,
        uf: m.uf,
        vendedor_id: m.vendedor_id,
        vendedor_nome: (m.profiles as any)?.nome
      }));
      
      setMunicipios(municipiosFormatados);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAtribuir = async () => {
    if (!selectedMunicipio || !selectedVendedor) {
      toast({
        title: "Atenção",
        description: "Selecione um município e um vendedor",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("municipios")
        .update({ vendedor_id: selectedVendedor })
        .eq("id", selectedMunicipio);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Município atribuído ao vendedor",
      });

      setSelectedMunicipio("");
      setSelectedVendedor("");
      fetchData();
    } catch (error) {
      console.error("Erro ao atribuir município:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atribuir o município",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (municipioId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("municipios")
        .update({ vendedor_id: null })
        .eq("id", municipioId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Vendedor removido do município",
      });

      fetchData();
    } catch (error) {
      console.error("Erro ao remover atribuição:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a atribuição",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const municipiosSemVendedor = municipios.filter(m => !m.vendedor_id);
  const municipiosComVendedor = municipios.filter(m => m.vendedor_id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atribuir Município a Vendedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Município</label>
              <Select value={selectedMunicipio} onValueChange={setSelectedMunicipio}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um município" />
                </SelectTrigger>
                <SelectContent>
                  {municipiosSemVendedor.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} - {m.uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vendedor</label>
              <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} ({v.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleAtribuir} 
            disabled={loading || !selectedMunicipio || !selectedVendedor}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Atribuir Município
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Municípios Atribuídos ({municipiosComVendedor.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {municipiosComVendedor.map((municipio) => (
              <div
                key={municipio.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {municipio.nome} - {municipio.uf}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vendedor: {municipio.vendedor_nome}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemover(municipio.id)}
                  disabled={loading}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {municipiosComVendedor.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum município atribuído ainda
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Municípios Sem Vendedor ({municipiosSemVendedor.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {municipiosSemVendedor.map((municipio) => (
              <div
                key={municipio.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <p className="font-medium">
                  {municipio.nome} - {municipio.uf}
                </p>
                <Badge variant="secondary">Sem vendedor</Badge>
              </div>
            ))}
            {municipiosSemVendedor.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Todos os municípios estão atribuídos
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
