/**
 * Diálogo de gestão de pastas de projetos.
 * Pastas compartilhadas exigem alçada (admin / gerente geral de Projetos);
 * pastas pessoais são livres para cada usuário.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PASTA_CORES,
  type PastaEscopo,
  type ProjetoPasta,
} from "@/hooks/useProjetoPastas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastas: ProjetoPasta[];
  contagens: Map<string, number>;
  podeGerirCompartilhadas: boolean;
  onCriar: (input: { nome: string; cor: string; escopo: PastaEscopo }) => void;
  onAtualizar: (input: { id: string; nome?: string; cor?: string }) => void;
  onExcluir: (id: string) => void;
  isSaving?: boolean;
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (cor: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PASTA_CORES.map((cor) => (
        <button
          key={cor}
          type="button"
          aria-label={`Cor ${cor}`}
          onClick={() => onChange(cor)}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform",
            value === cor ? "border-foreground scale-110" : "border-transparent",
          )}
          style={{ backgroundColor: cor }}
        />
      ))}
    </div>
  );
}

function PastaList({
  pastas,
  contagens,
  readOnly,
  onAtualizar,
  onPedirExclusao,
}: {
  pastas: ProjetoPasta[];
  contagens: Map<string, number>;
  readOnly: boolean;
  onAtualizar: Props["onAtualizar"];
  onPedirExclusao: (pasta: ProjetoPasta) => void;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunhoNome, setRascunhoNome] = useState("");
  const [rascunhoCor, setRascunhoCor] = useState(PASTA_CORES[0]);

  if (pastas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma pasta criada ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {pastas.map((pasta) => {
        const editando = editandoId === pasta.id;
        return (
          <li
            key={pasta.id}
            className="rounded-lg border border-border/60 bg-card/60 px-3 py-2"
          >
            {editando ? (
              <div className="space-y-2">
                <Input
                  value={rascunhoNome}
                  onChange={(e) => setRascunhoNome(e.target.value)}
                  maxLength={60}
                  className="h-8"
                />
                <div className="flex items-center justify-between gap-2">
                  <ColorSwatches value={rascunhoCor} onChange={setRascunhoCor} />
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Cancelar edição"
                      onClick={() => setEditandoId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Salvar pasta"
                      disabled={!rascunhoNome.trim()}
                      onClick={() => {
                        onAtualizar({
                          id: pasta.id,
                          nome: rascunhoNome,
                          cor: rascunhoCor,
                        });
                        setEditandoId(null);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pasta.cor }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {pasta.nome}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {contagens.get(pasta.id) ?? 0} projeto
                  {(contagens.get(pasta.id) ?? 0) === 1 ? "" : "s"}
                </span>
                {!readOnly && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={`Editar pasta ${pasta.nome}`}
                      onClick={() => {
                        setEditandoId(pasta.id);
                        setRascunhoNome(pasta.nome);
                        setRascunhoCor(pasta.cor);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      aria-label={`Excluir pasta ${pasta.nome}`}
                      onClick={() => onPedirExclusao(pasta)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProjetoPastasManagerDialog({
  open,
  onOpenChange,
  pastas,
  contagens,
  podeGerirCompartilhadas,
  onCriar,
  onAtualizar,
  onExcluir,
  isSaving,
}: Props) {
  const [aba, setAba] = useState<PastaEscopo>("pessoal");
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(PASTA_CORES[0]);
  const [paraExcluir, setParaExcluir] = useState<ProjetoPasta | null>(null);

  const compartilhadas = pastas.filter((p) => p.escopo === "compartilhada");
  const pessoais = pastas.filter((p) => p.escopo === "pessoal");
  const podeCriarNaAba = aba === "pessoal" || podeGerirCompartilhadas;

  const criar = () => {
    if (!novoNome.trim()) return;
    onCriar({ nome: novoNome, cor: novaCor, escopo: aba });
    setNovoNome("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pastas de projetos</DialogTitle>
            <DialogDescription>
              Pastas apenas organizam a visualização. Nenhuma permissão ou acesso a
              projetos é alterado.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={aba} onValueChange={(v) => setAba(v as PastaEscopo)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pessoal">Minhas pastas</TabsTrigger>
              <TabsTrigger value="compartilhada">Compartilhadas</TabsTrigger>
            </TabsList>

            <TabsContent value="pessoal" className="mt-4 space-y-4">
              <PastaList
                pastas={pessoais}
                contagens={contagens}
                readOnly={false}
                onAtualizar={onAtualizar}
                onPedirExclusao={setParaExcluir}
              />
            </TabsContent>

            <TabsContent value="compartilhada" className="mt-4 space-y-4">
              {!podeGerirCompartilhadas && (
                <p className="text-xs text-muted-foreground">
                  Somente administradores e o gerente geral de Projetos podem criar ou
                  editar pastas compartilhadas.
                </p>
              )}
              <PastaList
                pastas={compartilhadas}
                contagens={contagens}
                readOnly={!podeGerirCompartilhadas}
                onAtualizar={onAtualizar}
                onPedirExclusao={setParaExcluir}
              />
            </TabsContent>
          </Tabs>

          {podeCriarNaAba && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label htmlFor="nova-pasta" className="text-xs">
                Nova pasta {aba === "pessoal" ? "pessoal" : "compartilhada"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="nova-pasta"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") criar();
                  }}
                  maxLength={60}
                  placeholder="Ex.: Marketing, Fábrica, Prioridade Q3"
                  className="h-8"
                />
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={criar}
                  disabled={!novoNome.trim() || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Criar
                </Button>
              </div>
              <ColorSwatches value={novaCor} onChange={setNovaCor} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!paraExcluir}
        onOpenChange={(o) => !o && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta "{paraExcluir?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os projetos dentro dela não são excluídos — apenas deixam de estar
              agrupados nesta pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (paraExcluir) onExcluir(paraExcluir.id);
                setParaExcluir(null);
              }}
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
