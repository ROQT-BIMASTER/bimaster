import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjetos } from "@/hooks/useProjetos";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { ChevronRight, ChevronLeft } from "lucide-react";

const CORES = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];
const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

const ORIGENS = [
  { value: "china", label: "China (Importação)" },
  { value: "brasil", label: "Brasil (Nacional)" },
  { value: "collab", label: "Collab / Parceria" },
  { value: "recompra", label: "Recompra" },
];

const MARCAS = [
  "Ruby Rose",
  "HB",
  "Maiana",
  "Outra",
];

export const TEMPLATES = {
  generico: {
    label: "Projeto Genérico",
    desc: "Seções padrão para tarefas do dia a dia",
    secoes: [
      "Atribuídas recentemente",
      "A fazer hoje",
      "A fazer na próxima semana",
      "A fazer mais tarde",
    ],
  },
  desenvolvimento_produto: {
    label: "Desenvolvimento de Produto",
    desc: "Pipeline completo: Criação → Embalagem → Regulatório → Lançamento",
    secoes: [
      "Criação / Identidade",
      "Desenvolvimento de Produtos",
      "Desenvolvimento de Embalagem",
      "Informações dos Produtos (Briefing)",
      "Assuntos Regulatórios",
      "Criação / Artes",
    ],
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

interface NovoProjetoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoProjetoDialog({ open, onOpenChange }: NovoProjetoDialogProps) {
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [template, setTemplate] = useState<TemplateKey>("generico");
  const [departamentoId, setDepartamentoId] = useState<string>("");
  // Phase 2: Wizard fields
  const [marca, setMarca] = useState("");
  const [categoriaLinha, setCategoriaLinha] = useState("");
  const [origemProjeto, setOrigemProjeto] = useState("brasil");

  const { createProjeto } = useProjetos();
  const { isAdmin } = usePermissions();
  const { data: userDepartments = [] } = useUserDepartments();

  const isDevTeam = isAdmin || userDepartments.some(d => d.id === DEV_DEPARTMENT_ID);
  const isDevProduto = template === "desenvolvimento_produto";
  const totalSteps = isDevProduto ? 2 : 1;

  const availableTemplates = useMemo(() => {
    if (isDevTeam) return Object.entries(TEMPLATES);
    return Object.entries(TEMPLATES).filter(([key]) => key === "generico");
  }, [isDevTeam]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    await createProjeto.mutateAsync({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      cor,
      template,
      ...(isDevProduto ? {
        marca: marca || undefined,
        categoriaLinha: categoriaLinha || undefined,
        origemProjeto,
      } : {}),
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setNome("");
    setDescricao("");
    setCor(CORES[0]);
    setTemplate("generico");
    setMarca("");
    setCategoriaLinha("");
    setOrigemProjeto("brasil");
    setStep(1);
    onOpenChange(false);
  };

  const canNext = step === 1 && nome.trim();
  const canSubmit = step === totalSteps && nome.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Novo Projeto
            {totalSteps > 1 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Passo {step} de {totalSteps}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do projeto</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Institucional | Ruby Rose" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descrição do projeto" />
            </div>

            {/* Template */}
            <div className="space-y-2">
              <Label>Template</Label>
              <RadioGroup value={template} onValueChange={v => setTemplate(v as TemplateKey)} className="space-y-2">
                {availableTemplates.map(([key, t]) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={key} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {CORES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    className="w-8 h-8 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: cor === c ? "white" : "transparent", transform: cor === c ? "scale(1.2)" : "scale(1)" }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && isDevProduto && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dados adicionais para o projeto de desenvolvimento de produto.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Select value={marca} onValueChange={setMarca}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {MARCAS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={origemProjeto} onValueChange={setOrigemProjeto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria / Linha</Label>
              <Input value={categoriaLinha} onChange={e => setCategoriaLinha(e.target.value)} placeholder="Ex: Maquiagem, Skincare, Corpo..." />
            </div>
          </div>
        )}

        {/* Preview card — shown on last step for ALL templates */}
        {step === totalSteps && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Preview do projeto</Label>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
                style={{ backgroundColor: cor }}
              >
                <span className="text-white text-lg font-bold">{nome.charAt(0) || "?"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{nome || "Nome do projeto"}</p>
                {descricao && <p className="text-xs text-muted-foreground truncate">{descricao}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {TEMPLATES[template].label}
                  </span>
                  {marca && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{marca}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
            {step < totalSteps ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canSubmit || createProjeto.isPending}>
                {createProjeto.isPending ? "Criando..." : "Criar Projeto"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
