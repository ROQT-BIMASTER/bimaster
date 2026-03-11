import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProjetos } from "@/hooks/useProjetos";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUserDepartments } from "@/hooks/useUserDepartments";

const CORES = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];
const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

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
    desc: "Pipeline com equipes: Criação, Embalagem, Regulatório, Artes",
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
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [template, setTemplate] = useState<TemplateKey>("generico");
  const { createProjeto } = useProjetos();
  const { isAdmin } = usePermissions();
  const { data: userDepartments = [] } = useUserDepartments();

  const isDevTeam = isAdmin || userDepartments.some(d => d.id === DEV_DEPARTMENT_ID);

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
    });
    setNome("");
    setDescricao("");
    setCor(CORES[0]);
    setTemplate("generico");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!nome.trim() || createProjeto.isPending}>
            {createProjeto.isPending ? "Criando..." : "Criar Projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
