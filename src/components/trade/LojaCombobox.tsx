import { useState } from "react";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface LojaComboboxProps {
  value: string; // "none" or store id
  onChange: (value: string) => void;
  stores: Array<{ id: string; name: string; code: string }>;
  onAddNew?: () => void;
}

export function LojaCombobox({ value, onChange, stores, onAddNew }: LojaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selected = value !== "none" ? stores.find(s => s.id === value) : null;

  const filtered = stores.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Store className="h-4 w-4" />
        Loja/PDV
      </Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal h-9 text-sm"
              type="button"
            >
              {selected ? `${selected.code} - ${selected.name}` : "Selecione a loja (opcional)"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por código ou nome..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => { onChange("none"); setOpen(false); setSearchQuery(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")} />
                    <span className="text-muted-foreground">Nenhuma loja</span>
                  </CommandItem>
                  {filtered.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => { onChange(s.id); setOpen(false); setSearchQuery(""); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span>{s.code} - {s.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {onAddNew && (
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onAddNew}>
            <span className="text-lg leading-none">+</span>
          </Button>
        )}
      </div>
    </div>
  );
}
