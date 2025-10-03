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

interface Prospect {
  id: string;
  nome_empresa: string;
  municipio?: string;
  vendedor_id: string | null;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

export const AtribuirProspectsDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      // Buscar prospects sem vendedor
      const { data: prospectsData, error: prospectsError } = await supabase
        .from("prospects")
        .select("id, nome_empresa, municipio, vendedor_id")
        .is("vendedor_id", null)
        .order("nome_empresa");

      if (prospectsError) throw prospectsError;
      setProspects(prospectsData || []);

      // Buscar vendedores
      const { data: vendedoresData, error: vendedoresError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("tipo_usuario", ["vendedor", "supervisor"])
        .order("nome");

      if (vendedoresError) throw vendedoresError;
      setVendedores(vendedoresData || []);
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
    if (selectedProspects.size === prospects.length) {
      setSelectedProspects(new Set());
    } else {
      setSelectedProspects(new Set(prospects.map((p) => p.id)));
    }
  };

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
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Atribuir Prospects em Massa</DialogTitle>
          <DialogDescription>
            Selecione os prospects e o vendedor para atribuição
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendedor">Vendedor *</Label>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prospects sem Vendedor ({prospects.length})</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
              >
                {selectedProspects.size === prospects.length
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-md p-4">
              {prospects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum prospect sem vendedor
                </p>
              ) : (
                <div className="space-y-2">
                  {prospects.map((prospect) => (
                    <div
                      key={prospect.id}
                      className="flex items-center space-x-2 p-2 border rounded hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedProspects.has(prospect.id)}
                        onCheckedChange={() => handleToggleProspect(prospect.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{prospect.nome_empresa}</p>
                        {prospect.municipio && (
                          <p className="text-sm text-muted-foreground">
                            {prospect.municipio}
                          </p>
                        )}
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
