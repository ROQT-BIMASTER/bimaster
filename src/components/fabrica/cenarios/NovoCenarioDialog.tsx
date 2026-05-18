import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGruposCenarios } from "@/hooks/useGrupoCenarios";
import { NovoProdutoAcabadoDialog } from "@/components/fabrica/NovoProdutoAcabadoDialog";
import { toast } from "sonner";
import { Layers, Plus } from "lucide-react";

const schema = z.object({
  mode: z.enum(["novo", "existente"]),
  grupo_existente: z.string().uuid().nullable(),
  label: z.string().trim().min(2, "Informe um apelido para o cenário").max(80),
}).strict();

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pré-selecionar grupo existente (ao adicionar cenário dentro de um grupo). */
  defaultGrupoId?: string;
}

export function NovoCenarioDialog({ open, onOpenChange, onSuccess, defaultGrupoId }: Props) {
  const [mode, setMode] = useState<"novo" | "existente">(defaultGrupoId ? "existente" : "novo");
  const [grupoExistente, setGrupoExistente] = useState<string | null>(defaultGrupoId ?? null);
  const [label, setLabel] = useState("");
  const [stage, setStage] = useState<"setup" | "form">("setup");
  const [cenarioContext, setCenarioContext] = useState<{ grupo_cenario_id: string; cenario_label: string } | null>(null);

  const { data: grupos = [], isLoading: gruposLoading } = useGruposCenarios();

  const reset = () => {
    setMode(defaultGrupoId ? "existente" : "novo");
    setGrupoExistente(defaultGrupoId ?? null);
    setLabel("");
    setStage("setup");
    setCenarioContext(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleContinuar = () => {
    const parsed = schema.safeParse({
      mode,
      grupo_existente: mode === "existente" ? grupoExistente : null,
      label,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Dados inválidos");
      return;
    }
    if (mode === "existente" && !grupoExistente) {
      toast.error("Selecione um grupo existente");
      return;
    }
    const gid = mode === "novo" ? crypto.randomUUID() : grupoExistente!;
    setCenarioContext({ grupo_cenario_id: gid, cenario_label: label.trim() });
    setStage("form");
  };

  if (stage === "form" && cenarioContext) {
    return (
      <NovoProdutoAcabadoDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          onOpenChange(o);
        }}
        cenarioContext={cenarioContext}
        onSuccess={() => {
          toast.success("Cenário criado");
          reset();
          onSuccess();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Novo Cenário de Simulação
          </DialogTitle>
          <DialogDescription>
            Cenários ficam isolados do catálogo oficial. Use para testar composições e custos antes de promover o vencedor a produto acabado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Grupo de simulação</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "novo" | "existente")}>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="novo" id="opt-novo" className="mt-0.5" />
                <Label htmlFor="opt-novo" className="font-normal cursor-pointer flex-1">
                  <div className="font-medium">Novo grupo</div>
                  <div className="text-xs text-muted-foreground">Cria um novo grupo só com este cenário. Outros poderão ser adicionados depois.</div>
                </Label>
              </div>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="existente" id="opt-existente" className="mt-0.5" disabled={grupos.length === 0} />
                <Label htmlFor="opt-existente" className={`font-normal cursor-pointer flex-1 ${grupos.length === 0 ? "opacity-50" : ""}`}>
                  <div className="font-medium">Adicionar a um grupo existente</div>
                  <div className="text-xs text-muted-foreground">
                    {grupos.length === 0 ? "Nenhum grupo aberto ainda." : `${grupos.length} grupo(s) em aberto.`}
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {mode === "existente" && (
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={grupoExistente ?? undefined} onValueChange={setGrupoExistente} disabled={gruposLoading}>
                <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => (
                    <SelectItem key={g.grupo_cenario_id} value={g.grupo_cenario_id}>
                      {g.primeiro_nome} ({g.total} cenário{g.total > 1 ? "s" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="label-cen">Apelido do cenário</Label>
            <Input
              id="label-cen"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Cenário A — fornecedor SP"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">Aparece na visão comparativa para diferenciar os cenários.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleContinuar}>
            <Plus className="h-4 w-4 mr-1.5" />
            Continuar para o cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
