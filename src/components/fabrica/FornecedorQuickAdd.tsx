import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onFornecedorCriado: (fornecedor: { id: string; nome: string }) => void;
}

export function FornecedorQuickAdd({ onFornecedorCriado }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_fornecedores")
        .insert({
          razao_social: nome.trim(),
          nome_fantasia: nome.trim(),
          cnpj: cnpj.trim() || null,
          ativo: true,
        })
        .select("id, razao_social")
        .single();

      if (error) throw error;

      toast.success("Fornecedor cadastrado!");
      onFornecedorCriado({ id: data.id, nome: data.razao_social });
      setNome("");
      setCnpj("");
      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao criar fornecedor:", error);
      toast.error("Erro ao cadastrar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Cadastrar novo fornecedor"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Novo Fornecedor</h4>
          
          <div>
            <Label htmlFor="quick-nome">Nome / Razão Social *</Label>
            <Input
              id="quick-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do fornecedor"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="quick-cnpj">CNPJ (opcional)</Label>
            <Input
              id="quick-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSalvar}
              disabled={saving || !nome.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
