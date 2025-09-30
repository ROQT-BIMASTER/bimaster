import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Municipio {
  id: string;
  nome: string;
  uf: string;
  regiao: string;
  vendedor_id: string | null;
}

const Municipios = () => {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
    } finally {
      setLoading(false);
    }
  };

  const getRegiaoColor = (regiao: string) => {
    const regiaoMap: { [key: string]: "default" | "secondary" | "outline" } = {
      Norte: "default",
      Sul: "secondary",
      Leste: "outline",
      Oeste: "default",
      Centro: "secondary",
    };
    return regiaoMap[regiao] || "outline";
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
            <p className="text-muted-foreground">Gerencie os municípios e suas atribuições</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Município
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Municípios</CardTitle>
            <CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por município ou UF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando municípios...</div>
            ) : filteredMunicipios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum município encontrado" : "Nenhum município cadastrado"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Município</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMunicipios.map((municipio) => (
                    <TableRow key={municipio.id}>
                      <TableCell className="font-medium">{municipio.nome}</TableCell>
                      <TableCell>{municipio.uf}</TableCell>
                      <TableCell>
                        <Badge variant={getRegiaoColor(municipio.regiao)}>
                          {municipio.regiao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {municipio.vendedor_id ? (
                          <span className="text-sm">Atribuído</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Não atribuído</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {municipio.vendedor_id ? (
                          <Badge variant="default">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Disponível</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Municipios;
