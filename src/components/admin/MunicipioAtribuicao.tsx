import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserMinus, Loader2, Trash2 } from "lucide-react";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [municipioToDelete, setMunicipioToDelete] = useState<Municipio | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar vendedores
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email");

      if (profilesError) throw profilesError;

      // Buscar roles dos vendedores
      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .in("role", ["vendedor", "supervisor"]);

      if (rolesError) throw rolesError;

      // Filtrar apenas vendedores e supervisores
      const vendedorIds = new Set(rolesData?.map(r => r.user_id) || []);
      const vendData = profilesData?.filter(p => vendedorIds.has(p.id)) || [];
      
      setVendedores(vendData);

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

  const handleDeleteMunicipio = async () => {
    if (!municipioToDelete) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("municipios")
        .delete()
        .eq("id", municipioToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Município excluído com sucesso",
      });

      setDeleteDialogOpen(false);
      setMunicipioToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Erro ao excluir município:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o município",
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
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemover(municipio.id)}
                    disabled={loading}
                    title="Remover vendedor"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setMunicipioToDelete(municipio);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={loading}
                    title="Excluir município"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Sem vendedor</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMunicipioToDelete(municipio);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={loading}
                    title="Excluir município"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o município "{municipioToDelete?.nome} - {municipioToDelete?.uf}"? 
              Esta ação não pode ser desfeita e todos os prospects relacionados perderão o vínculo com este município.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMunicipio} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
