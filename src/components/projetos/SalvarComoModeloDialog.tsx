import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjetoModelos, capturarEstruturaProjeto } from "@/hooks/useProjetoModelos";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { usePermissions } from "@/contexts/PermissionsContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
  projetoNome: string;
  projetoCor?: string | null;
  projetoTipo?: string;
}

export function SalvarComoModeloDialog({ open, onOpenChange, projetoId, projetoNome, projetoCor, projetoTipo }: Props) {
  const [nome, setNome] = useState(`Modelo: ${projetoNome}`);
  const [descricao, setDescricao] = useState("");
  const [escopo, setEscopo] = useState<"pessoal" | "departamento" | "organizacao">("pessoal");
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [incluirSubtarefas, setIncluirSubtarefas] = useState(true);
  const [incluirPrazos, setIncluirPrazos] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const { createModelo } = useProjetoModelos();
  const { isAdmin } = usePermissions();
  const { data: userDepartments = [] } = useUserDepartments();

  const handleSalvar = async () => {
    if (!nome.trim()) return;
    if (escopo === "departamento" && !departamentoId) {
      toast.error("Selecione o departamento");
      return;
    }
    setSalvando(true);
    try {
      const estrutura = await capturarEstruturaProjeto(projetoId, { incluirSubtarefas, incluirPrazos });
      await createModelo.mutateAsync({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cor: projetoCor || "#6366f1",
        escopo,
        departamento_id: escopo === "departamento" ? departamentoId : null,
        vinculado_produto: projetoTipo === "desenvolvimento_produto",
        estrutura,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar modelo: " + (err?.message ?? String(err)));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do modelo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quando usar este modelo, o que ele cobre..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Quem pode usar</Label>
            <Select value={escopo} onValueChange={(v: any) => setEscopo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoal">Apenas eu</SelectItem>
                <SelectItem value="departamento">Meu departamento</SelectItem>
                {isAdmin && <SelectItem value="organizacao">Toda a organização</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {escopo === "departamento" && (
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departamentoId} onValueChange={setDepartamentoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {userDepartments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="text-sm">Incluir subtarefas</Label>
              <p className="text-[11px] text-muted-foreground">Copiar a árvore completa de subtarefas.</p>
            </div>
            <Switch checked={incluirSubtarefas} onCheckedChange={setIncluirSubtarefas} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="text-sm">Manter prazos relativos</Label>
              <p className="text-[11px] text-muted-foreground">Salva a duração das tarefas (em dias) para recalcular ao reaplicar.</p>
            </div>
            <Switch checked={incluirPrazos} onCheckedChange={setIncluirPrazos} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando || !nome.trim()}>
            {salvando ? "Salvando..." : "Salvar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
