import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

interface TradeFiltersProps {
  onStoreChange: (storeId: string | null) => void;
  onAIFilter: (criteria: any) => void;
  selectedStore: string | null;
}

interface Store {
  id: string;
  name: string;
  code: string;
}

export const TradeFilters = ({ onStoreChange, onAIFilter, selectedStore }: TradeFiltersProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [aiQuery, setAiQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const handleAISearch = async () => {
    if (!aiQuery.trim()) {
      toast.error("Digite algo para filtrar");
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-filter", {
        body: { query: aiQuery }
      });

      if (error) throw error;

      onAIFilter(data.criteria);
      toast.success("Filtro aplicado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao processar filtro IA:", error);
      toast.error("Erro ao processar filtro: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFilters = () => {
    onStoreChange(null);
    setAiQuery("");
    onAIFilter(null);
    toast.success("Filtros limpos");
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 bg-card rounded-lg border">
      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Filtrar por Cliente</label>
        <Select value={selectedStore || "all"} onValueChange={(value) => onStoreChange(value === "all" ? null : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name} ({store.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Filtro Inteligente (IA)</label>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: visitas da última semana, promoções ativas, fotos não processadas..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAISearch()}
          />
          <Button 
            onClick={handleAISearch} 
            disabled={isProcessing}
            className="shrink-0"
          >
            {isProcessing ? (
              <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-end">
        <Button variant="outline" onClick={clearFilters} className="shrink-0">
          <X className="h-4 w-4 mr-2" />
          Limpar
        </Button>
      </div>
    </div>
  );
};
