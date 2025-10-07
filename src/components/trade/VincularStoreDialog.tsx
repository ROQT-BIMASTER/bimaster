import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface Store {
  id: string;
  code: string;
  name: string;
  chain: string | null;
  city: string | null;
  state: string | null;
}

interface VincularStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId?: string;
  onStoreLinked?: (storeId: string) => void;
}

export const VincularStoreDialog = ({
  open,
  onOpenChange,
  visitId,
  onStoreLinked,
}: VincularStoreDialogProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchStores();
    }
  }, [open]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = stores.filter(
        (store) =>
          store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.chain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.city?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStores(filtered);
    } else {
      setFilteredStores(stores);
    }
  }, [searchTerm, stores]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, code, name, chain, city, state")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setStores(data || []);
      setFilteredStores(data || []);
    } catch (error) {
      console.error("Erro ao buscar lojas:", error);
      toast.error("Erro ao carregar lojas");
    }
  };

  const handleVincular = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja");
      return;
    }

    if (!visitId) {
      // Se não tem visitId, apenas retorna o ID da loja selecionada
      onStoreLinked?.(selectedStoreId);
      onOpenChange(false);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("visits")
        .update({ store_id: selectedStoreId })
        .eq("id", visitId);

      if (error) throw error;

      toast.success("Loja vinculada com sucesso!");
      onStoreLinked?.(selectedStoreId);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao vincular loja:", error);
      toast.error("Erro ao vincular loja: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Vincular Loja à Visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Buscar Loja</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código, rede ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Selecione a Loja</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma loja..." />
              </SelectTrigger>
              <SelectContent>
                {filteredStores.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma loja encontrada
                  </div>
                ) : (
                  filteredStores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{store.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {store.code}
                          {store.chain && ` • ${store.chain}`}
                          {store.city && store.state && ` • ${store.city}/${store.state}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {stores.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma loja cadastrada. Importe lojas primeiro.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = "/dashboard/trade-marketing/import-stores";
                }}
              >
                Ir para Importação
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleVincular} disabled={!selectedStoreId || loading}>
            {loading ? "Vinculando..." : "Vincular Loja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
