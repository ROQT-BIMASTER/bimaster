/**
 * Diálogo para colocar vários projetos já existentes em uma pasta,
 * ou transferi-los entre pastas, de uma só vez.
 * Pastas são apenas organização: não alteram permissões nem visibilidade.
 */
import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, FolderInput, FolderMinus } from "lucide-react";
import type { ProjetoPasta } from "@/hooks/useProjetoPastas";

interface ProjetoResumo {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetos: ProjetoResumo[];
  pastas: ProjetoPasta[];
  /** projeto_id -> pasta_id efetiva */
  pastaPorProjeto: Map<string, string>;
  podeGerirCompartilhadas: boolean;
  /** Pasta pré-selecionada (a ativa na barra), quando houver. */
  pastaPreSelecionada?: string;
  isSaving?: boolean;
  onMoverEmLote: (input: { projetoIds: string[]; pastaId: string | null }) => void;
}

export function ProjetoPastasAtribuirDialog({
  open,
  onOpenChange,
  projetos,
  pastas,
  pastaPorProjeto,
  podeGerirCompartilhadas,
  pastaPreSelecionada,
  isSaving,
  onMoverEmLote,
}: Props) {
  const [destino, setDestino] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const disponiveis = useMemo(
    () => pastas.filter((p) => p.escopo === "pessoal" || podeGerirCompartilhadas),
    [pastas, podeGerirCompartilhadas],
  );

  useEffect(() => {
    if (!open) return;
    setBusca("");
    setSelecionados(new Set());
    const valida = pastaPreSelecionada && disponiveis.some((p) => p.id === pastaPreSelecionada);
    setDestino(valida ? pastaPreSelecionada! : "");
  }, [open, pastaPreSelecionada, disponiveis]);

  const nomePasta = useMemo(() => {
    const map = new Map<string, ProjetoPasta>();
    for (const p of pastas) map.set(p.id, p);
    return map;
  }, [pastas]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo
      ? projetos.filter((p) => (p.nome || "").toLowerCase().includes(termo))
      : projetos;
    return [...lista].sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [projetos, busca]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selecionarTodos = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      filtrados.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const total = selecionados.size;
  const compartilhadas = disponiveis.filter((p) => p.escopo === "compartilhada");
  const pessoais = disponiveis.filter((p) => p.escopo === "pessoal");

  const mover = (pastaId: string | null) => {
    if (total === 0) return;
    onMoverEmLote({ projetoIds: Array.from(selecionados), pastaId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Organizar projetos em pastas</DialogTitle>
          <DialogDescription>
            Selecione os projetos e escolha a pasta de destino. Projetos que já estão em
            outra pasta são transferidos. Pastas não alteram permissões nem visibilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pasta de destino</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma pasta" />
              </SelectTrigger>
              <SelectContent>
                {compartilhadas.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Compartilhadas</SelectLabel>
                    {compartilhadas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {pessoais.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Pessoais</SelectLabel>
                    {pessoais.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {disponiveis.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma pasta disponível. Crie uma pasta em "Gerenciar pastas".
              </p>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar projetos..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {total} selecionado{total === 1 ? "" : "s"} de {filtrados.length} exibido
              {filtrados.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selecionarTodos}>
                Selecionar todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelecionados(new Set())}
              >
                Limpar
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[320px] rounded-md border border-border/60">
            <ul className="divide-y divide-border/50">
              {filtrados.map((p) => {
                const atualId = pastaPorProjeto.get(p.id);
                const atual = atualId ? nomePasta.get(atualId) : undefined;
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selecionados.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      <span className="flex-1 truncate text-sm">{p.nome}</span>
                      {atual ? (
                        <Badge variant="outline" className="gap-1.5 text-[10px]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: atual.cor }}
                          />
                          {atual.nome}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Sem pasta
                        </Badge>
                      )}
                    </label>
                  </li>
                );
              })}
              {filtrados.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum projeto encontrado.
                </li>
              )}
            </ul>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => mover(null)}
            disabled={total === 0 || isSaving}
            className="gap-2"
          >
            <FolderMinus className="h-4 w-4" /> Remover da pasta
          </Button>
          <Button
            onClick={() => mover(destino)}
            disabled={total === 0 || !destino || isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderInput className="h-4 w-4" />
            )}
            Mover {total > 0 ? total : ""} projeto{total === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
