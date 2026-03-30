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
import { Package, Minus, Plus, Loader2, CheckCircle2, ShoppingCart, Search, Eye, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CnpjApiData {
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

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
  isPublic?: boolean;
}

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function MaterialRequestCard({ material, formId, isPublic = false }: MaterialRequestCardProps) {
  const [state, setState] = useState<"idle" | "selecting" | "submitting" | "submitted">("idle");
  const [selectedStore, setSelectedStore] = useState<{ id: string; name: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [protocol, setProtocol] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [storePopoverOpen, setStorePopoverOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // CNPJ lookup states (public mode)
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjData, setCnpjData] = useState<CnpjApiData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const { stores, loading: storesLoading } = useFilteredStores({ activeOnly: true });

  const maxQty = material.max_por_solicitacao || 999;
  const cnpjClean = cnpjInput.replace(/\D/g, "");

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(storeSearch))
  );

  async function handleCnpjSearch() {
    if (cnpjClean.length !== 14) return;
    setCnpjLoading(true);
    setCnpjData(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("CNPJ não encontrado na Receita Federal");
        } else {
          toast.error("Erro ao consultar CNPJ. Tente novamente.");
        }
        return;
      }
      const data: CnpjApiData = await res.json();
      setCnpjData(data);
      toast.success("Dados carregados da Receita Federal!");
    } catch {
      toast.error("Erro ao consultar CNPJ. Verifique sua conexão.");
    } finally {
      setCnpjLoading(false);
    }
  }

  function generateProtocol() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `MAT-${yy}${mm}${dd}-${rand}`;
  }

  async function handleConfirm() {
    if (!isPublic && !selectedStore) {
      toast.error("Selecione uma loja");
      return;
    }
    if (isPublic && !cnpjData) {
      toast.error("Busque o CNPJ antes de confirmar");
      return;
    }

    setState("submitting");
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const proto = generateProtocol();

      // Try to find matching internal store by CNPJ
      let lojaId: string | null = null;
      let lojaNome = "";

      if (isPublic && cnpjData) {
        lojaNome = cnpjData.razao_social || cnpjData.nome_fantasia || cnpjClean;
        const { data: matchedStore } = await supabase
          .from("stores")
          .select("id, name")
          .eq("cnpj", cnpjClean)
          .maybeSingle();
        if (matchedStore) {
          lojaId = matchedStore.id;
          lojaNome = matchedStore.name;
        }
      } else if (selectedStore) {
        lojaId = selectedStore.id;
        lojaNome = selectedStore.name;
      }

      const endereco = cnpjData
        ? [cnpjData.logradouro, cnpjData.numero, cnpjData.municipio, cnpjData.uf].filter(Boolean).join(", ")
        : "";

      const { error } = await supabase
        .from("trade_material_solicitacoes" as any)
        .insert({
          material_id: material.id,
          user_id: user?.id || null,
          loja_id: lojaId,
          loja_nome: lojaNome,
          quantidade: quantity,
          status: "pendente",
          observacoes: isPublic
            ? `CNPJ: ${cnpjClean} | ${endereco} | Via formulário (${formId})`
            : `Solicitação via formulário dinâmico (${formId})`,
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
          <button type="button" onClick={() => setShowDetail(true)} className="shrink-0 cursor-pointer">
            <img src={material.foto_url} alt={material.nome} className="h-12 w-12 rounded-md object-cover" />
          </button>
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
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowDetail(true)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {state === "idle" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState("selecting")}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Solicitar
            </Button>
          )}
        </div>
      </div>

      {state === "selecting" && (
        <div className="mt-4 space-y-3 pt-3 border-t">
          {/* Store selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">{isPublic ? "CNPJ da loja" : "Loja de destino"}</Label>
            {isPublic ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={cnpjInput}
                    onChange={(e) => {
                      setCnpjInput(formatCnpj(e.target.value));
                      setCnpjData(null);
                    }}
                    className="h-9 text-sm"
                    maxLength={18}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-9"
                    onClick={handleCnpjSearch}
                    disabled={cnpjClean.length !== 14 || cnpjLoading}
                  >
                    {cnpjLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Buscar</span>
                  </Button>
                </div>
                {cnpjData && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium">{cnpjData.razao_social}</span>
                    </div>
                    {cnpjData.nome_fantasia && (
                      <p className="text-xs text-muted-foreground pl-6">{cnpjData.nome_fantasia}</p>
                    )}
                    {(cnpjData.logradouro || cnpjData.municipio) && (
                      <p className="text-xs text-muted-foreground pl-6">
                        {[cnpjData.logradouro, cnpjData.numero, cnpjData.municipio, cnpjData.uf].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
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
            )}
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
                setCnpjInput("");
                setCnpjData(null);
                setQuantity(1);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={isPublic ? !cnpjData : !selectedStore}
            >
              Confirmar Solicitação
            </Button>
          </div>
        </div>
      )}
      {/* Material Detail Dialog — inline, no navigation */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{material.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {material.foto_url && (
              <img
                src={material.foto_url}
                alt={material.nome}
                className="w-full rounded-lg object-contain max-h-64"
              />
            )}
            {material.descricao && (
              <p className="text-sm text-muted-foreground">{material.descricao}</p>
            )}
            <Button
              className="w-full"
              onClick={() => {
                setShowDetail(false);
                setState("selecting");
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Solicitar este material
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
