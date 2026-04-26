import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Link2, Plus, Loader2, FolderPlus, Search } from "lucide-react";
import { useProjetos } from "@/hooks/useProjetos";
import { toast } from "sonner";

interface Props {
  rowId: string;
  rowNome: string;
  isLinked: boolean;
  projetos: Array<{ id: string; nome: string; cor?: string }>;
  onLink: (projetoId: string) => void | Promise<void>;
}

const PRESET_COLORS = [
  "#6366F1", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16",
];

export function VincularChinaRowAction({ rowId, rowNome, isLinked, projetos, onLink }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState(false);

  // Form de criação
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(PRESET_COLORS[0]);
  const { createProjeto } = useProjetos();

  const filtered = projetos.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleLinkExisting = async (projetoId: string) => {
    setLinking(true);
    try {
      await onLink(projetoId);
      setPopoverOpen(false);
    } finally {
      setLinking(false);
    }
  };

  const openCreate = () => {
    setNovoNome(rowNome ? `Projeto — ${rowNome}` : "");
    setNovaCor(PRESET_COLORS[0]);
    setPopoverOpen(false);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!novoNome.trim()) {
      toast.error("Informe um nome para o projeto");
      return;
    }
    setLinking(true);
    try {
      const novo = await createProjeto.mutateAsync({
        nome: novoNome.trim(),
        cor: novaCor,
        template: "generico",
      });
      if (novo?.id) {
        await onLink(novo.id);
      }
      setCreateOpen(false);
    } catch (e) {
      // toast já tratado pelo hook
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {linking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className={`h-3.5 w-3.5 ${isLinked ? "text-success" : ""}`} />
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
              {isLinked ? "Já vinculado — vincular a outro projeto" : "Vincular a projeto"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PopoverContent
          className="w-72 p-2"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div className="px-2 pt-1 pb-2">
              <p className="text-xs font-semibold text-foreground">Vincular ao projeto</p>
              <p className="text-[10px] text-muted-foreground truncate">{rowNome}</p>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar projeto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum projeto encontrado</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleLinkExisting(p.id)}
                    disabled={linking}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left disabled:opacity-50"
                  >
                    {p.cor && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.cor }}
                      />
                    )}
                    <span className="flex-1 truncate">{p.nome}</span>
                  </button>
                ))
              )}
            </div>

            <div className="border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1.5"
                onClick={openCreate}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Criar novo projeto com este produto
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Novo projeto
            </DialogTitle>
            <DialogDescription>
              O produto <strong className="text-foreground">{rowNome}</strong> será vinculado automaticamente ao projeto criado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="novo-projeto-nome" className="text-xs">Nome do projeto</Label>
              <Input
                id="novo-projeto-nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Lançamento Verão 2026"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNovaCor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      novaCor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={linking}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={linking || !novoNome.trim()} className="gap-1.5">
              {linking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar e vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
