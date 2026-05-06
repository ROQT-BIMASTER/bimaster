import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { EmitirOCDialog } from "@/components/china/EmitirOCDialog";
import { ChevronsUpDown, FileText, Package, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface NovaOCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Origem = "submissao" | "produto";

export function NovaOCDialog({ open, onOpenChange, onSuccess }: NovaOCDialogProps) {
  const [origem, setOrigem] = useState<Origem>("submissao");
  const [search, setSearch] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [emitOpen, setEmitOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSearch("");
      setOrigem("submissao");
    }
  }, [open]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["nova-oc-origens", origem, search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome, qty_total, ean_caixa_master, status, aprovado_em, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (origem === "submissao") {
        q = q.in("status", ["aprovada", "homologada", "em_producao_homologada", "aprovado"]);
      }
      if (search.trim()) {
        q = q.or(`produto_codigo.ilike.%${search}%,produto_nome.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      let list = (data || []) as any[];
      if (origem === "produto") {
        const seen = new Set<string>();
        list = list.filter((s) => {
          if (seen.has(s.produto_codigo)) return false;
          seen.add(s.produto_codigo);
          return true;
        });
      }
      return list;
    },
  });

  const handleContinuar = () => {
    if (!selected) return;
    setEmitOpen(true);
  };

  return (
    <>
      <Dialog open={open && !emitOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Compra</DialogTitle>
            <DialogDescription>
              Escolha de onde a OC será gerada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={origem} onValueChange={(v) => { setOrigem(v as Origem); setSelected(null); }} className="grid grid-cols-2 gap-2">
              <Label htmlFor="ori-sub" className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5">
                <RadioGroupItem value="submissao" id="ori-sub" className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm"><FileText className="h-3.5 w-3.5" />Submissão China</div>
                  <p className="text-[11px] text-muted-foreground mt-1">Submissões aprovadas/homologadas, com qty e EAN definidos.</p>
                </div>
              </Label>
              <Label htmlFor="ori-prod" className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5">
                <RadioGroupItem value="produto" id="ori-prod" className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm"><Package className="h-3.5 w-3.5" />Produto China</div>
                  <p className="text-[11px] text-muted-foreground mt-1">Catálogo completo de produtos China (última submissão).</p>
                </div>
              </Label>
            </RadioGroup>

            <div className="space-y-1.5">
              <Label className="text-xs">Selecione</Label>
              <Popover open={popOpen} onOpenChange={setPopOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selected ? (
                      <span className="truncate">{selected.produto_codigo} — {selected.produto_nome}</span>
                    ) : (
                      <span className="text-muted-foreground">Buscar produto ou submissão...</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar..." value={search} onValueChange={setSearch} />
                    <CommandList>
                      {isLoading && <div className="p-3 text-xs text-muted-foreground text-center">Carregando...</div>}
                      <CommandEmpty>Nada encontrado.</CommandEmpty>
                      <CommandGroup>
                        {items.map((it) => (
                          <CommandItem
                            key={it.id}
                            value={it.id}
                            onSelect={() => { setSelected(it); setPopOpen(false); }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{it.produto_codigo}</span>
                              <span className="text-xs text-muted-foreground truncate">{it.produto_nome}</span>
                              <span className="text-[10px] text-muted-foreground">Qty homologada: {(it.qty_total ?? 0).toLocaleString("pt-BR")} · {it.status}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleContinuar} disabled={!selected}>Continuar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selected && (
        <EmitirOCDialog
          open={emitOpen}
          onOpenChange={(o) => {
            setEmitOpen(o);
            if (!o) onOpenChange(false);
          }}
          submissao={selected}
          onSuccess={() => {
            onSuccess();
            setEmitOpen(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
