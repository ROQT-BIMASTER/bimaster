import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSalvarTarefaComoModelo } from "@/hooks/useTarefaModelos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const schema = z
  .object({
    nome: z.string().trim().min(1, "Informe um nome").max(200),
    descricao_curta: z.string().trim().max(500).optional().or(z.literal("")),
    escopo: z.enum(["pessoal", "departamento", "organizacao"]),
  })
  .strict();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefaId: string | null;
  tarefaTitulo?: string;
}

export function SalvarTarefaComoModeloDialog({ open, onOpenChange, tarefaId, tarefaTitulo }: Props) {
  const { user } = useAuth();
  const [nome, setNome] = useState(tarefaTitulo || "");
  const [descricao, setDescricao] = useState("");
  const [escopo, setEscopo] = useState<"pessoal" | "departamento" | "organizacao">("pessoal");
  const salvar = useSalvarTarefaComoModelo();

  const { data: profile } = useQuery({
    queryKey: ["profile-departamento", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("departamento_id, departamentos:departamentos!profiles_departamento_id_fkey(nome)")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const departamentoId = (profile as any)?.departamento_id ?? null;
  const departamentoNome = (profile as any)?.departamentos?.nome ?? null;

  const handleSubmit = async () => {
    if (!tarefaId) return;
    const parsed = schema.safeParse({ nome, descricao_curta: descricao, escopo });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Dados inválidos");
      return;
    }
    if (escopo === "departamento" && !departamentoId) {
      toast.error("Você não está vinculado a um departamento");
      return;
    }
    await salvar.mutateAsync({
      tarefaId,
      nome: parsed.data.nome,
      descricao_curta: parsed.data.descricao_curta || null,
      escopo: parsed.data.escopo,
      departamento_id: departamentoId,
    });
    onOpenChange(false);
    setDescricao("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como modelo</DialogTitle>
          <DialogDescription>
            Captura título, descrição, prioridade, prazo relativo, tags e subtarefas.
            Não copia responsáveis, seguidores, anexos, comentários ou histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="modelo-nome">Nome do modelo</Label>
            <Input
              id="modelo-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Onboarding de fornecedor"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelo-desc">Descrição curta (opcional)</Label>
            <Textarea
              id="modelo-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Escopo</Label>
            <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as any)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="pessoal" id="esc-pessoal" className="mt-0.5" />
                <Label htmlFor="esc-pessoal" className="font-normal">
                  Pessoal — só você vê e usa
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  value="departamento"
                  id="esc-dep"
                  disabled={!departamentoId}
                  className="mt-0.5"
                />
                <Label htmlFor="esc-dep" className="font-normal">
                  Departamento {departamentoNome ? `— ${departamentoNome}` : "(nenhum vinculado)"}
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="organizacao" id="esc-org" className="mt-0.5" />
                <Label htmlFor="esc-org" className="font-normal">
                  Organização — todos os usuários
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={salvar.isPending || !tarefaId}>
            {salvar.isPending ? "Salvando..." : "Salvar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
