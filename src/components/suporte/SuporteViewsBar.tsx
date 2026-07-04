import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bookmark, MoreVertical, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuporteFila } from "@/hooks/suporte/types";
import {
  useSuporteViews,
  type SuporteView,
  type SuporteViewFiltros,
  type SuporteViewOrdenacao,
} from "@/hooks/suporte/useSuporteViews";
import type { TicketColuna } from "@/lib/suporte/exportTickets";

interface Props {
  filaIds: string[];
  filasSelecionaveis: SuporteFila[];
  podeCompartilhar: boolean;
  filtros: SuporteViewFiltros;
  colunas: TicketColuna[];
  ordenacao: SuporteViewOrdenacao;
  viewAtivaId: string | null;
  onAplicar: (view: SuporteView) => void;
  onLimparView: () => void;
}

export function SuporteViewsBar({
  filaIds,
  filasSelecionaveis,
  podeCompartilhar,
  filtros,
  colunas,
  ordenacao,
  viewAtivaId,
  onAplicar,
  onLimparView,
}: Props) {
  const { data: views = [], criar, remover } = useSuporteViews(filaIds);

  const [novoOpen, setNovoOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);
  const [filaId, setFilaId] = useState<string>(filasSelecionaveis[0]?.id ?? "");

  const salvar = () => {
    if (!nome.trim()) return;
    criar.mutate(
      {
        nome: nome.trim(),
        escopo: compartilhar ? "fila" : "pessoal",
        fila_id: compartilhar ? filaId : null,
        filtros,
        colunas,
        ordenacao,
      },
      {
        onSuccess: () => {
          setNovoOpen(false);
          setNome("");
          setCompartilhar(false);
        },
      },
    );
  };

  if (views.length === 0 && !novoOpen) {
    return (
      <div className="flex items-center gap-2">
        <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Nenhuma view salva.</span>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3 w-3" /> Salvar visão atual
        </Button>
        <NovoDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          nome={nome}
          setNome={setNome}
          compartilhar={compartilhar}
          setCompartilhar={setCompartilhar}
          filaId={filaId}
          setFilaId={setFilaId}
          filasSelecionaveis={filasSelecionaveis}
          podeCompartilhar={podeCompartilhar}
          onSalvar={salvar}
          isPending={criar.isPending}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Bookmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {views.map((v) => {
          const ativa = viewAtivaId === v.id;
          return (
            <div
              key={v.id}
              className={cn(
                "inline-flex items-center rounded-full border text-xs",
                ativa ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
              )}
            >
              <button
                className="pl-2.5 pr-1 py-0.5 flex items-center gap-1"
                onClick={() => onAplicar(v)}
              >
                {v.nome}
                {v.escopo === "fila" && (
                  <Users className={cn("h-3 w-3", ativa ? "opacity-80" : "text-muted-foreground")} />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-1 py-0.5 opacity-70 hover:opacity-100">
                    <MoreVertical className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAplicar(v)}>Aplicar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => remover.mutate(v.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs px-2" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3 w-3" /> Salvar visão
        </Button>
        {viewAtivaId && (
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-muted-foreground" onClick={onLimparView}>
            Limpar
          </Button>
        )}
      </div>
      <NovoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        nome={nome}
        setNome={setNome}
        compartilhar={compartilhar}
        setCompartilhar={setCompartilhar}
        filaId={filaId}
        setFilaId={setFilaId}
        filasSelecionaveis={filasSelecionaveis}
        podeCompartilhar={podeCompartilhar}
        onSalvar={salvar}
        isPending={criar.isPending}
      />
    </>
  );
}

function NovoDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string;
  setNome: (v: string) => void;
  compartilhar: boolean;
  setCompartilhar: (v: boolean) => void;
  filaId: string;
  setFilaId: (v: string) => void;
  filasSelecionaveis: SuporteFila[];
  podeCompartilhar: boolean;
  onSalvar: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Salvar visão atual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome-view" className="text-xs">Nome</Label>
            <Input
              id="nome-view"
              value={props.nome}
              onChange={(e) => props.setNome(e.target.value)}
              placeholder="Ex.: SLA violado hoje"
              autoFocus
            />
          </div>
          {props.podeCompartilhar && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Compartilhar com o departamento</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Todos os agentes ativos da fila verão esta view.
                  </p>
                </div>
                <Switch checked={props.compartilhar} onCheckedChange={props.setCompartilhar} />
              </div>
              {props.compartilhar && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Departamento</Label>
                  <Select value={props.filaId} onValueChange={props.setFilaId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {props.filasSelecionaveis.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={props.onSalvar}
            disabled={!props.nome.trim() || props.isPending || (props.compartilhar && !props.filaId)}
          >
            Salvar view
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Chip discreto para mostrar o número de views compartilhadas (informativo). */
export function ViewsCountBadge({ count, tipo }: { count: number; tipo: "pessoal" | "fila" }) {
  return (
    <Badge variant="outline" className="text-[10px]">
      {count} {tipo === "pessoal" ? "pessoal(is)" : "compartilhada(s)"}
    </Badge>
  );
}
