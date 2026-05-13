import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Bookmark, Star, Trash2, Plus, Loader2 } from "lucide-react";
import {
  useSavedFiltersRecebimento, useSaveFilter,
  useSetDefaultFilter, useDeleteSavedFilter, type SavedFilter, type SavedFilterPayload,
} from "@/hooks/useSavedFiltersRecebimento";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  current: SavedFilterPayload;
  onApply: (p: SavedFilterPayload) => void;
}

export function SavedFiltersMenu({ current, onApply }: Props) {
  const { data: filters = [], isLoading } = useSavedFiltersRecebimento();
  const save = useSaveFilter();
  const setDefault = useSetDefaultFilter();
  const del = useDeleteSavedFilter();

  const [openSave, setOpenSave] = useState(false);
  const [nome, setNome] = useState("");
  const [asDefault, setAsDefault] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) return;
    await save.mutateAsync({ nome: nome.trim(), payload: current, is_default: asDefault });
    setNome(""); setAsDefault(false); setOpenSave(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-3.5 w-3.5 mr-1" /> Filtros salvos
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Aplicar</DropdownMenuLabel>
          {isLoading && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </div>
          )}
          {!isLoading && filters.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhum filtro salvo.
            </div>
          )}
          {filters.map((f: SavedFilter) => (
            <DropdownMenuItem
              key={f.id}
              className="flex items-center justify-between gap-2"
              onSelect={(e) => { e.preventDefault(); onApply(f.payload); }}
            >
              <span className="truncate flex-1">{f.nome}</span>
              <Star
                className={`h-3.5 w-3.5 cursor-pointer ${f.is_default ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                onClick={(e) => { e.stopPropagation(); setDefault.mutate(f.id); }}
              />
              <Trash2
                className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); if (confirm(`Remover "${f.nome}"?`)) del.mutate(f.id); }}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpenSave(true); }}>
            <Plus className="h-3.5 w-3.5 mr-2" /> Salvar filtro atual…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openSave} onOpenChange={setOpenSave}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Salvar filtro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: OCs com divergência" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={asDefault} onCheckedChange={(v) => setAsDefault(!!v)} />
              Marcar como padrão (aplicado ao abrir a página)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSave(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!nome.trim() || save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
