import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { debounce } from "@/lib/utils/debounce";
import { useFilteredStores } from "@/hooks/useFilteredStores";

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
  city?: string;
  address?: string;
}

export const TradeFilters = ({ onStoreChange, onAIFilter, selectedStore }: TradeFiltersProps) => {
  // Usar hook centralizado para lojas filtradas por permissão
  const { stores: filteredStoresFromHook, loading: storesLoading } = useFilteredStores();
  
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Atualizar lista filtrada quando hook retornar dados
  useEffect(() => {
    if (!storesLoading) {
      setFilteredStores(filteredStoresFromHook);
    }
  }, [filteredStoresFromHook, storesLoading]);

  // Debounced filter function
  const debouncedFilter = useMemo(
    () =>
      debounce((query: string) => {
        if (query.trim()) {
          const searchLower = query.toLowerCase();
          const searchNumbers = query.replace(/\D/g, '');
          
          const filtered = filteredStoresFromHook.filter(store => {
            const nameMatch = store.name?.toLowerCase().includes(searchLower);
            const codeMatch = store.code?.toLowerCase().includes(searchLower);
            const cnpjMatch = searchNumbers && store.cnpj?.replace(/\D/g, '').includes(searchNumbers);
            const cityMatch = store.city?.toLowerCase().includes(searchLower);
            const addressMatch = store.address?.toLowerCase().includes(searchLower);
            return nameMatch || codeMatch || cnpjMatch || cityMatch || addressMatch;
          });
          setFilteredStores(filtered);
          setShowDropdown(true);
        } else {
          setFilteredStores(filteredStoresFromHook);
          setShowDropdown(false);
          if (selectedStore) {
            onStoreChange(null);
          }
        }
      }, 300),
    [filteredStoresFromHook, selectedStore, onStoreChange]
  );

  useEffect(() => {
    debouncedFilter(searchQuery);
  }, [searchQuery, filteredStoresFromHook, debouncedFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectStore = (store: Store) => {
    onStoreChange(store.id);
    setSearchQuery(store.name);
    setShowDropdown(false);
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
        <div className="space-y-2" ref={dropdownRef}>
          <div className="relative">
            <Input
              placeholder="Digite o nome, código, CNPJ, cidade ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowDropdown(true)}
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
                  setShowDropdown(false);
                }}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Lista de resultados */}
          {showDropdown && searchQuery && (
            <div className="absolute z-50 mt-1 border rounded-md bg-background shadow-lg max-h-60 overflow-y-auto w-[calc(100%-2rem)]">
              {filteredStores.length > 0 ? (
                <div className="p-1">
                  {filteredStores.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                        selectedStore === store.id ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onClick={() => handleSelectStore(store)}
                    >
                      <div className="font-medium">{store.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {store.code}
                        {store.cnpj && ` • ${store.cnpj}`}
                        {store.city && ` • ${store.city}`}
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
