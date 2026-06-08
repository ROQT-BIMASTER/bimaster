/**
 * PromoverAnexoCofreDialog — diálogo para promover um anexo da conversa
 * (chat de tarefa) para o Cofre do produto vinculado à tarefa.
 *
 * Permite escolher a categoria e a pasta/coleção (com vínculo opcional a
 * uma equipe/departamento). Pastas novas podem ser criadas inline.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FolderPlus, Loader2, ShieldCheck, X } from "lucide-react";
import {
  useCofreProdutoPastas,
  useDepartamentosOptions,
  useMeuDepartamento,
} from "@/hooks/cofre/useCofreProdutoPastas";
import { Switch } from "@/components/ui/switch";
import { Users } from "lucide-react";

export const COFRE_CATEGORIAS = [
  "briefing",
  "arte_final",
  "rotulo",
  "ficha_tecnica",
  "laudo",
  "certificado",
  "orcamento",
  "nota_fiscal",
  "art",
  "outro",
] as const;

export const COFRE_CATEGORIA_LABELS: Record<string, string> = {
  briefing: "Briefing",
  arte_final: "Arte Final",
  rotulo: "Rótulo",
  ficha_tecnica: "Ficha Técnica",
  laudo: "Laudo",
  certificado: "Certificado",
  orcamento: "Orçamento",
  nota_fiscal: "Nota Fiscal",
  art: "ART",
  outro: "Outro",
};

const SEM_PASTA = "__sem_pasta__";
const SEM_EQUIPE = "__sem_equipe__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anexoId: string;
  anexoNome: string;
  produtoId: string;
  projetoId?: string | null;
  sendToCofre: {
    mutateAsync: (args: {
      anexoIds: string[];
      produtoId: string;
      categoriasPorAnexo: Record<string, string>;
      projetoId?: string;
      pastasPorAnexo?: Record<string, string | null>;
    }) => Promise<unknown>;
    isPending?: boolean;
  };
  onPromoted?: (categoria: string) => void;
}

export function PromoverAnexoCofreDialog({
  open,
  onOpenChange,
  anexoId,
  anexoNome,
  produtoId,
  projetoId,
  sendToCofre,
  onPromoted,
}: Props) {
  const [categoria, setCategoria] = useState<string>("");
  const [pastaId, setPastaId] = useState<string>(SEM_PASTA);
  const [submitting, setSubmitting] = useState(false);

  const [creatingPasta, setCreatingPasta] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [novaPastaEquipe, setNovaPastaEquipe] = useState<string>(SEM_EQUIPE);

  const { pastasQuery, createPasta } = useCofreProdutoPastas(produtoId);
  const { data: departamentos = [] } = useDepartamentosOptions();
  const { data: meuDepto } = useMeuDepartamento();
  const pastas = pastasQuery.data ?? [];

  // Filtro automático "minha equipe": liga por padrão quando o usuário
  // tem departamento atribuído. Pastas sem equipe (globais) sempre aparecem.
  const [filtrarMinhaEquipe, setFiltrarMinhaEquipe] = useState(true);
  const meuDeptoId = meuDepto?.id ?? null;

  const pastasVisiveis = useMemo(() => {
    if (!filtrarMinhaEquipe || !meuDeptoId) return pastas;
    return pastas.filter(
      (p) => p.departamento_id === meuDeptoId || p.departamento_id === null,
    );
  }, [pastas, filtrarMinhaEquipe, meuDeptoId]);

  const totalOcultas = pastas.length - pastasVisiveis.length;

  const pastaSelecionada = useMemo(
    () => pastas.find((p) => p.id === pastaId) || null,
    [pastas, pastaId],
  );

  // Se a pasta atualmente selecionada for filtrada para fora, volta para "sem pasta"
  // para evitar gravar um valor que o usuário não vê mais.
  useEffect(() => {
    if (
      pastaId !== SEM_PASTA &&
      pastaSelecionada &&
      filtrarMinhaEquipe &&
      meuDeptoId &&
      pastaSelecionada.departamento_id !== meuDeptoId &&
      pastaSelecionada.departamento_id !== null
    ) {
      setPastaId(SEM_PASTA);
    }
  }, [pastaId, pastaSelecionada, filtrarMinhaEquipe, meuDeptoId]);

  const resetState = () => {
    setCategoria("");
    setPastaId(SEM_PASTA);
    setCreatingPasta(false);
    setNovaPastaNome("");
    setNovaPastaEquipe(SEM_EQUIPE);
  };

  const handleCreatePasta = async () => {
    const nome = novaPastaNome.trim();
    if (!nome) {
      toast.error("Informe o nome da pasta.");
      return;
    }
    try {
      const pasta = await createPasta.mutateAsync({
        nome,
        departamento_id: novaPastaEquipe === SEM_EQUIPE ? null : novaPastaEquipe,
      });
      setPastaId(pasta.id);
      setCreatingPasta(false);
      setNovaPastaNome("");
      setNovaPastaEquipe(SEM_EQUIPE);
    } catch {
      /* toast já tratado no hook */
    }
  };

  const handleConfirm = async () => {
    if (!categoria) {
      toast.error("Selecione a categoria do Cofre.");
      return;
    }
    setSubmitting(true);
    try {
      const pastaFinal = pastaId === SEM_PASTA ? null : pastaId;
      await sendToCofre.mutateAsync({
        anexoIds: [anexoId],
        produtoId,
        categoriasPorAnexo: { [anexoId]: categoria },
        pastasPorAnexo: { [anexoId]: pastaFinal },
        projetoId: projetoId || undefined,
      });
      toast.success("Documento promovido ao Cofre.");
      onPromoted?.(categoria);
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao promover ao Cofre.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          onOpenChange(o);
          if (!o) resetState();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Promover ao Cofre
          </DialogTitle>
          <DialogDescription>
            O arquivo bruto permanece nos anexos da tarefa. Uma cópia
            categorizada será publicada no Cofre do produto vinculado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Documento:</span>{" "}
            <span className="font-medium">{anexoNome}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cofre-categoria" className="text-xs">
              Categoria do Cofre
            </Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="cofre-categoria" className="h-9 text-sm">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {COFRE_CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COFRE_CATEGORIA_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cofre-pasta" className="text-xs">
                Pasta / Coleção
              </Label>
              {!creatingPasta && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setCreatingPasta(true);
                    // Pré-seleciona a equipe do usuário ao criar nova pasta
                    if (meuDeptoId) setNovaPastaEquipe(meuDeptoId);
                  }}
                >
                  <FolderPlus className="h-3 w-3 mr-1" /> Nova pasta
                </Button>
              )}
            </div>

            {!creatingPasta ? (
              <>
                {meuDeptoId && meuDepto?.nome && (
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2 py-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>
                        Só da minha equipe (<span className="font-medium text-foreground">{meuDepto.nome}</span>)
                      </span>
                      {filtrarMinhaEquipe && totalOcultas > 0 && (
                        <span className="text-muted-foreground/80">
                          · {totalOcultas} oculta{totalOcultas === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <Switch
                      checked={filtrarMinhaEquipe}
                      onCheckedChange={setFiltrarMinhaEquipe}
                      aria-label="Filtrar pastas pela minha equipe"
                    />
                  </div>
                )}
                <Select value={pastaId} onValueChange={setPastaId}>
                  <SelectTrigger id="cofre-pasta" className="h-9 text-sm">
                    <SelectValue placeholder="Sem pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_PASTA}>Sem pasta (raiz)</SelectItem>
                    {pastasVisiveis.length === 0 && (
                      <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                        Nenhuma pasta para a sua equipe.
                      </div>
                    )}
                    {pastasVisiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                        {p.departamento?.nome ? ` — ${p.departamento.nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pastaSelecionada?.departamento?.nome && (
                  <p className="text-[11px] text-muted-foreground">
                    Equipe: {pastaSelecionada.departamento.nome}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Criar pasta</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setCreatingPasta(false);
                      setNovaPastaNome("");
                      setNovaPastaEquipe(SEM_EQUIPE);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={novaPastaNome}
                  onChange={(e) => setNovaPastaNome(e.target.value)}
                  placeholder="Nome da pasta"
                  className="h-8 text-sm"
                />
                <Select value={novaPastaEquipe} onValueChange={setNovaPastaEquipe}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Equipe (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_EQUIPE}>Sem equipe</SelectItem>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8"
                  onClick={handleCreatePasta}
                  disabled={createPasta.isPending || !novaPastaNome.trim()}
                >
                  {createPasta.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Criando…
                    </>
                  ) : (
                    "Criar e usar"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !categoria}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Promovendo…
              </>
            ) : (
              "Promover ao Cofre"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
