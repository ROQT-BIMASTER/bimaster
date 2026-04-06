import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaSecaoDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: projetos = [] } = useQuery({
    queryKey: ["meus-projetos-select", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("projeto_membros")
        .select("projeto_id, projetos:projeto_id(id, nome, cor)")
        .eq("user_id", user.id);
      return (data || []).map((m: any) => ({
        id: m.projetos?.id,
        nome: m.projetos?.nome,
        cor: m.projetos?.cor || "#6366f1",
      })).filter((p: any) => p.id);
    },
    enabled: !!user?.id && open,
  });

  const handleSubmit = async () => {
    if (!nome.trim() || !projetoId) return;
    setSaving(true);

    const { data: maxOrdem } = await supabase
      .from("projeto_secoes")
      .select("ordem")
      .eq("projeto_id", projetoId)
      .order("ordem", { ascending: false })
      .limit(1);

    const nextOrdem = ((maxOrdem?.[0]?.ordem as number) || 0) + 1;

    const { error } = await supabase.from("projeto_secoes").insert({
      nome: nome.trim(),
      projeto_id: projetoId,
      ordem: nextOrdem,
    });

    setSaving(false);
    if (error) {
      toast.error(`Erro ao criar seção: ${error.message}`);
      return;
    }

    toast.success("Seção criada!");
    queryClient.invalidateQueries({ queryKey: ["projeto-secoes"] });
    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    setNome("");
    setProjetoId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Nova Seção
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.cor }} />
                      {p.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nome da Seção</Label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Backlog, Em andamento..."
              autoFocus
              onKeyDown={e => e.key === "Enter" && !saving && handleSubmit()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!nome.trim() || !projetoId || saving}>
            {saving ? "Criando..." : "Criar seção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
