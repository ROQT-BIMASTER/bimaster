import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Package, Minus, Plus, ShoppingCart, CheckCircle2, Copy, ChevronsUpDown, Check, Building2, Search, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradeMaterial, useCreateSolicitacao } from "@/hooks/useTradeMateriais";
import { useFilteredStores } from "@/hooks/useFilteredStores";
import { CadastroClienteCnpjDialog } from "./CadastroClienteCnpjDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  material: TradeMaterial | null;
  onClose: () => void;
}

function generateProtocol(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `MAT-${y}${m}${d}-${seq}`;
}

export function MaterialOrderSheet({ material, onClose }: Props) {
  const { stores, loading: storesLoading } = useFilteredStores();
  const createSolicitacao = useCreateSolicitacao();

  const [lojaId, setLojaId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [storeSearchOpen, setStoreSearchOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [showCadastro, setShowCadastro] = useState(false);

  const maxQty = material?.max_por_solicitacao || 999;
  const selectedStore = stores.find((s) => s.id === lojaId);

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const q = storeSearch.toLowerCase();
    const qNumbers = storeSearch.replace(/\D/g, "");
    return stores.filter((s) => {
      const nameMatch = s.name?.toLowerCase().includes(q);
      const cnpjMatch = qNumbers && s.cnpj?.replace(/\D/g, "").includes(qNumbers);
      return nameMatch || cnpjMatch;
    });
  }, [stores, storeSearch]);

  useEffect(() => {
    if (material) {
      setLojaId("");
      setQuantidade(1);
      setObservacoes("");
      setProtocol(null);
      setStoreSearch("");
      setStoreSearchOpen(false);
    }
  }, [material?.id]);

  const handleSubmit = async () => {
    if (!material) return;
    if (!lojaId) {
      toast.error("Selecione uma loja/cliente");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const proto = generateProtocol();

      await createSolicitacao.mutateAsync({
        material_id: material.id,
        user_id: user.id,
        loja_id: lojaId,
        loja_nome: selectedStore?.name || null,
        quantidade,
        observacoes: observacoes || null,
        status: "pendente",
        obs_interna: `Protocolo: ${proto}`,
      });

      setProtocol(proto);
    } catch {
      // error handled by mutation
    } finally {
      setSubmitting(false);
    }
  };

  const copyProtocol = () => {
    if (protocol) {
      navigator.clipboard.writeText(protocol);
      toast.success("Protocolo copiado!");
    }
  };

  const isOpen = !!material;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Solicitar Material
          </SheetTitle>
          <SheetDescription>Preencha os dados para enviar sua solicitação</SheetDescription>
        </SheetHeader>

        {material && !protocol && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Material Preview */}
            <div className="rounded-2xl overflow-hidden border border-border bg-muted">
              <div className="aspect-[3/2] flex items-center justify-center overflow-hidden">
                {material.foto_url ? (
                  <img src={material.foto_url} alt={material.nome} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                )}
              </div>
              <div className="p-3 bg-card">
                <p className="font-bold text-sm">{material.nome}</p>
                {material.descricao && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{material.descricao}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {material.categoria && (
                    <Badge variant="secondary" className="text-[10px]">{material.categoria}</Badge>
                  )}
                  {material.exibir_estoque && (
                    <Badge variant={material.estoque_atual > 0 ? "outline" : "destructive"} className="text-[10px]">
                      {material.estoque_atual > 0 ? `${material.estoque_atual} disponíveis` : "Sem estoque"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Store Select */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cliente / Loja *</Label>
              <Popover open={storeSearchOpen} onOpenChange={setStoreSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={storeSearchOpen}
                    className="w-full justify-between rounded-xl h-10 font-normal"
                  >
                    {lojaId && selectedStore ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{selectedStore.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {storesLoading ? "Carregando..." : "Buscar por CNPJ ou razão social..."}
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex flex-col">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Buscar por CNPJ ou razão social..."
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                      />
                      {storeSearch && (
                        <button onClick={() => setStoreSearch("")} className="p-1">
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {filteredStores.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma loja encontrada</p>
                      ) : (
                        filteredStores.map((s) => (
                          <button
                            key={s.id}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2",
                              lojaId === s.id && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => {
                              setLojaId(s.id);
                              setStoreSearch("");
                              setStoreSearchOpen(false);
                            }}
                          >
                            <Check className={cn("h-4 w-4 shrink-0", lojaId === s.id ? "opacity-100" : "opacity-0")} />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{s.name}</p>
                              {s.cnpj && <p className="text-xs text-muted-foreground">{s.cnpj}</p>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Quantidade</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl h-10 w-10"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  disabled={quantidade <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={quantidade}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    setQuantidade(Math.min(maxQty, Math.max(1, v)));
                  }}
                  className="text-center rounded-xl w-20 font-bold text-lg"
                  min={1}
                  max={maxQty}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl h-10 w-10"
                  onClick={() => setQuantidade((q) => Math.min(maxQty, q + 1))}
                  disabled={quantidade >= maxQty}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {material.max_por_solicitacao && (
                  <span className="text-xs text-muted-foreground">máx. {maxQty}</span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais (opcional)"
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Success State */}
        {protocol && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Solicitação Enviada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Seu pedido foi registrado com sucesso
              </p>
            </div>
            <div className="bg-muted rounded-xl p-4 w-full">
              <p className="text-xs text-muted-foreground mb-1">Protocolo</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xl font-mono font-bold tracking-wider">{protocol}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyProtocol}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Guarde este protocolo para acompanhar sua solicitação
            </p>
            <Button onClick={onClose} className="w-full rounded-xl mt-2">
              Fechar
            </Button>
          </div>
        )}

        {/* Submit Button */}
        {!protocol && material && (
          <div className="p-4 border-t border-border">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !lojaId || (material.exibir_estoque && material.estoque_atual <= 0 && !material.permitir_sem_estoque)}
              className="w-full rounded-xl h-12 text-base font-semibold"
            >
              {submitting ? "Enviando..." : "Confirmar Solicitação"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
