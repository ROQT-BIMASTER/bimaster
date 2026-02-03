import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TipoBrindeQuickAddProps {
  onSuccess?: (codigo: string) => void;
}

export function TipoBrindeQuickAdd({ onSuccess }: TipoBrindeQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const generateCodigo = (nome: string) => {
    return nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do tipo de brinde");
      return;
    }

    setIsSaving(true);
    try {
      const codigo = generateCodigo(nome);
      
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("trade_tipos_brinde")
        .insert({
          codigo,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          created_by: user.user?.id,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um tipo de brinde com este nome");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Tipo de brinde cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["tipos-brinde"] });
      
      if (onSuccess) {
        onSuccess(codigo);
      }

      setNome("");
      setDescricao("");
      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao cadastrar tipo de brinde:", error);
      toast.error("Erro ao cadastrar tipo de brinde");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" type="button">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Novo Tipo de Brinde
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              placeholder="Ex: Vale Compras"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              placeholder="Descrição opcional"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
