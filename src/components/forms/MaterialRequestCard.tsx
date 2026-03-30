import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFilteredStores } from "@/hooks/useFilteredStores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package, Minus, Plus, Loader2, CheckCircle2, ShoppingCart, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MaterialRequestCardProps {
  material: {
    id: string;
    nome: string;
    foto_url: string | null;
    descricao: string | null;
    max_por_solicitacao?: number | null;
    estoque_atual?: number;
  };
  formId: string;
}

export function MaterialRequestCard({ material, formId }: MaterialRequestCardProps) {
  const [state, setState] = useState<"idle" | "selecting" | "submitting" | "submitted">("idle");
  const [selectedStore, setSelectedStore] = useState<{ id: string; name: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [protocol, setProtocol] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [storePopoverOpen, setStorePopoverOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const { stores, loading: storesLoading } = useFilteredStores({ activeOnly: true });

  const maxQty = material.max_por_solicitacao || 999;

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(storeSearch))
  );

  function generateProtocol() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `MAT-${yy}${mm}${dd}-${rand}`;
  }

  async function handleConfirm() {
    if (!selectedStore) {
      toast.error("Selecione uma loja");
      return;
    }

    setState("submitting");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const proto = generateProtocol();

      const { error } = await supabase
        .from("trade_material_solicitacoes" as any)
        .insert({
          material_id: material.id,
          user_id: user.id,
          loja_id: selectedStore.id,
          loja_nome: selectedStore.name,
          quantidade: quantity,
          status: "pendente",
          observacoes: `Solicitação via formulário dinâmico (${formId})`,
        } as any);

      if (error) throw error;

      setProtocol(proto);
      setState("submitted");
      toast.success(`Solicitação enviada! Protocolo: ${proto}`);
    } catch (err: any) {
      console.error("Erro ao solicitar material:", err);
      toast.error("Erro ao enviar solicitação: " + err.message);
      setState("selecting");
    }
  }

  if (state === "submitted") {
    return (
      <Card className="p-4 border-success/30 bg-success/5">
        <div className="flex items-center gap-3">
          {material.foto_url ? (
            <img src={material.foto_url} alt={material.nome} className="h-12 w-12 rounded-md object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{material.nome}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-xs text-success font-medium">Solicitado — {protocol}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        {material.foto_url ? (
          <img src={material.foto_url} alt={material.nome} className="h-12 w-12 rounded-md object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{material.nome}</p>
          {material.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-1">{material.descricao}</p>
          )}
        </div>
        {state === "idle" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setState("selecting")}
            className="shrink-0"
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Solicitar
          </Button>
        )}
      </div>

      {state === "selecting" && (
        <div className="mt-4 space-y-3 pt-3 border-t">
          {/* Store selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Loja de destino</Label>
            <Popover open={storePopoverOpen} onOpenChange={setStorePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-sm font-normal h-9">
                  {selectedStore ? selectedStore.name : "Selecione a loja..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CNPJ..."
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {storesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : filteredStores.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma loja encontrada</p>
                  ) : (
                    filteredStores.slice(0, 50).map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedStore({ id: store.id, name: store.name });
                          setStorePopoverOpen(false);
                          setStoreSearch("");
                        }}
                      >
                        <span className="font-medium">{store.name}</span>
                        {store.cnpj && (
                          <span className="text-xs text-muted-foreground ml-2">{store.cnpj}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Quantity selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Quantidade</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, Number(e.target.value))))}
                className="w-20 h-8 text-center text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                disabled={quantity >= maxQty}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setState("idle");
                setSelectedStore(null);
                setQuantity(1);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={!selectedStore}
            >
              Confirmar Solicitação
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
