import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Prospect {
  id: string;
  nome_empresa: string;
  municipio?: string;
  municipio_id?: string;
  vendedor_id: string | null;
  status?: string;
  vendedor?: {
    nome: string;
  } | null;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Municipio {
  id: string;
  nome: string;
  uf: string;
}

interface AtribuirProspectsDialogProps {
  onSuccess?: () => void;
}

export const AtribuirProspectsDialog = ({ onSuccess }: AtribuirProspectsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("todos");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      // Buscar TODOS os prospects (com ou sem vendedor)
      const { data: prospectsData, error: prospectsError } = await supabase
        .from("prospects")
        .select(`
          id, 
          nome_empresa, 
          municipio, 
          municipio_id,
          vendedor_id,
          status,
          vendedor:profiles!prospects_vendedor_id_fkey(nome)
        `)
        .order("nome_empresa");

      if (prospectsError) throw prospectsError;
      setProspects(prospectsData || []);

      // Buscar municípios
      const { data: municipiosData, error: municipiosError } = await supabase
        .from("municipios")
        .select("id, nome, uf")
        .order("nome");

      if (municipiosError) throw municipiosError;
      setMunicipios(municipiosData || []);

      // Buscar vendedores
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome");

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
      const vendedoresData = profilesData?.filter(p => vendedorIds.has(p.id)) || [];
      
      setVendedores(vendedoresData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    }
  };

  const handleToggleProspect = (prospectId: string) => {
    setSelectedProspects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(prospectId)) {
        newSet.delete(prospectId);
      } else {
        newSet.add(prospectId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    const filtered = filteredProspects;
    if (selectedProspects.size === filtered.length && filtered.length > 0) {
      // Desmarcar apenas os filtrados
      const newSet = new Set(selectedProspects);
      filtered.forEach(p => newSet.delete(p.id));
      setSelectedProspects(newSet);
    } else {
      // Marcar todos os filtrados
      const newSet = new Set(selectedProspects);
      filtered.forEach(p => newSet.add(p.id));
      setSelectedProspects(newSet);
    }
  };

  const filteredProspects = prospects.filter((prospect) => {
    const matchesMunicipio = selectedMunicipio === "todos" || prospect.municipio_id === selectedMunicipio;
    return matchesMunicipio;
  });

  const handleSubmit = async () => {
    if (selectedProspects.size === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um prospect",
        variant: "destructive",
      });
      return;
    }

    if (!selectedVendedor) {
      toast({
        title: "Atenção",
        description: "Selecione um vendedor",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("prospects")
        .update({ vendedor_id: selectedVendedor })
        .in("id", Array.from(selectedProspects));

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${selectedProspects.size} prospect(s) atribuído(s) com sucesso`,
      });

      setSelectedProspects(new Set());
      setSelectedVendedor("");
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao atribuir prospects:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atribuir os prospects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Atribuir Prospects
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Atribuir Prospects em Massa</DialogTitle>
          <DialogDescription>
            Selecione múltiplos prospects e atribua a um vendedor de uma só vez. 
            Você pode atribuir ou reatribuir prospects existentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendedor">Vendedor *</Label>
              <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-[100]">
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} ({v.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="municipio">Filtrar por Município</Label>
              <Select value={selectedMunicipio} onValueChange={setSelectedMunicipio}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Todos os municípios" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-[100]">
                  <SelectItem value="todos">Todos os municípios</SelectItem>
                  {municipios.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} - {m.uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prospects Disponíveis ({filteredProspects.length})</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
              >
                {selectedProspects.size === filteredProspects.length && filteredProspects.length > 0
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-md p-4">
              {filteredProspects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {selectedMunicipio === "todos" 
                    ? "Nenhum prospect disponível" 
                    : "Nenhum prospect encontrado neste município"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredProspects.map((prospect) => (
                    <div
                      key={prospect.id}
                      className="flex items-center space-x-2 p-3 border rounded hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={selectedProspects.has(prospect.id)}
                        onCheckedChange={() => handleToggleProspect(prospect.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{prospect.nome_empresa}</p>
                          {prospect.status && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {prospect.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {prospect.municipio && (
                            <p className="text-sm text-muted-foreground truncate">
                              {prospect.municipio}
                            </p>
                          )}
                          {prospect.vendedor && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {prospect.vendedor.nome}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {selectedProspects.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedProspects.size} prospect(s) selecionado(s)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedProspects.size === 0 || !selectedVendedor}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atribuir {selectedProspects.size > 0 && `(${selectedProspects.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
