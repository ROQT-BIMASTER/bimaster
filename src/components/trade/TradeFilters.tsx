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
  cnpj?: string;
}

export const TradeFilters = ({ onStoreChange, onAIFilter, selectedStore }: TradeFiltersProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    filterStores();
  }, [searchQuery, stores]);

  const filterStores = () => {
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      const filtered = stores.filter(store => {
        const nameMatch = store.name.toLowerCase().includes(searchLower);
        const codeMatch = store.code.toLowerCase().includes(searchLower);
        const cnpjMatch = store.cnpj?.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, ''));
        return nameMatch || codeMatch || cnpjMatch;
      });
      setFilteredStores(filtered);
      
      // Se houver apenas uma loja encontrada, seleciona automaticamente
      if (filtered.length === 1 && filtered[0].id !== selectedStore) {
        onStoreChange(filtered[0].id);
      }
    } else {
      setFilteredStores(stores);
      // Se limpar a busca, remove o filtro
      if (selectedStore) {
        onStoreChange(null);
      }
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, code, cnpj")
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
    setSearchQuery("");
    onStoreChange(null);
    setAiQuery("");
    onAIFilter(null);
    toast.success("Filtros limpos");
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 bg-card rounded-lg border">
      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Buscar Cliente</label>
        <div className="space-y-2">
          <div className="relative">
            <Input
              placeholder="Digite o nome, código ou CNPJ do cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => {
                  setSearchQuery("");
                  onStoreChange(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Lista de resultados */}
          {searchQuery && (
            <div className="border rounded-md bg-background max-h-60 overflow-y-auto">
              {filteredStores.length > 0 ? (
                <div className="p-1">
                  {filteredStores.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                        selectedStore === store.id ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onClick={() => {
                        onStoreChange(store.id);
                        setSearchQuery(store.name);
                      }}
                    >
                      <div className="font-medium">{store.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {store.code}
                        {store.cnpj && ` • ${store.cnpj}`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>
          )}
        </div>
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
