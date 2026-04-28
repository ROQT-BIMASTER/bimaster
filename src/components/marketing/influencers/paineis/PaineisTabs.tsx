import { useState } from "react";
import { LayoutGrid, Plus, Settings, Pencil, Copy, Trash2, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { usePaineisInfluencers, type InfluencerPainel } from "./usePaineisInfluencers";
import { PainelDialog } from "./PainelDialog";
import { PAINEL_GERAL, type PainelFiltros, contarFiltrosAtivos } from "./painelFilters";

interface PaineisTabsProps {
  filtrosAtuais?: PainelFiltros;
}

export function PaineisTabs({ filtrosAtuais }: PaineisTabsProps) {
  const {
    paineis, painelAtivoId, setPainelAtivoId,
    criar, atualizar, excluir, duplicar, isOwner, painelAtivo,
  } = usePaineisInfluencers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<InfluencerPainel | null>(null);

  const abrirNovo = () => { setEditando(null); setDialogOpen(true); };
  const abrirEdicao = (p: InfluencerPainel) => { setEditando(p); setDialogOpen(true); };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-2">
      <button
        type="button"
        onClick={() => setPainelAtivoId(PAINEL_GERAL)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          painelAtivoId === PAINEL_GERAL
            ? "bg-primary text-primary-foreground"
            : "bg-muted hover:bg-muted/70 text-muted-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Geral
      </button>

      {paineis.map((p) => {
        const ativo = p.id === painelAtivoId;
        const meu = isOwner(p);
        return (
          <div
            key={p.id}
            className={cn(
              "group flex items-center gap-1 rounded-md text-sm font-medium transition-colors",
              ativo ? "ring-2 ring-offset-1" : "",
            )}
            style={ativo ? { boxShadow: `0 0 0 2px ${p.cor}` } : undefined}
          >
            <button
              type="button"
              onClick={() => setPainelAtivoId(p.id)}
              className={cn(
                "flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-l-md",
                ativo ? "text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
              style={ativo ? { background: `${p.cor}20` } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.cor }} />
              <span className="max-w-[160px] truncate">{p.nome}</span>
              {p.compartilhado ? (
                <Users className="h-3 w-3 text-muted-foreground" aria-label="Compartilhado" />
              ) : (
                <Lock className="h-3 w-3 text-muted-foreground" aria-label="Pessoal" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-1.5 py-1.5 rounded-r-md hover:bg-muted opacity-60 hover:opacity-100"
                  aria-label="Ações do painel"
                >
                  <Settings className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">{p.nome}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {meu && (
                  <DropdownMenuItem onClick={() => abrirEdicao(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => duplicar.mutate(p)}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                </DropdownMenuItem>
                {meu && (
                  <>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir painel?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O painel "{p.nome}" será removido permanentemente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluir.mutate(p.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <Button size="sm" variant="outline" onClick={abrirNovo} className="ml-1">
        <Plus className="h-3.5 w-3.5 mr-1" /> Novo painel
      </Button>

      {painelAtivo && (
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {contarFiltrosAtivos(painelAtivo.filtros)} filtros ativos
        </Badge>
      )}

      <PainelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        painel={editando}
        filtrosIniciais={editando ? undefined : filtrosAtuais}
        saving={criar.isPending || atualizar.isPending}
        onSave={(input) => {
          if (editando) {
            atualizar.mutate(
              { id: editando.id, patch: input },
              { onSuccess: () => setDialogOpen(false) },
            );
          } else {
            criar.mutate(input, { onSuccess: () => setDialogOpen(false) });
          }
        }}
      />
    </div>
  );
}
