import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { toast } from "sonner";

interface Props {
  produto: ProdutoBrasil;
}

export function ProjetoVinculoBanner({ produto }: Props) {
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("");
  const updateProduto = useUpdateProdutoBrasil();

  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos-list-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleVincular = () => {
    if (!selectedProjetoId) {
      toast.error("Selecione um projeto.");
      return;
    }
    updateProduto.mutate(
      { id: produto.id, projeto_id: selectedProjetoId },
      { onSuccess: () => toast.success("Projeto vinculado com sucesso!") }
    );
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-warning/50 bg-warning/10 p-4">
      <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Este produto ainda não está vinculado a um Projeto.
        </p>
        <p className="text-xs text-muted-foreground">
          A finalização do cadastro só será possível após a vinculação.
        </p>
      </div>
      <Select value={selectedProjetoId} onValueChange={setSelectedProjetoId}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Selecionar projeto" />
        </SelectTrigger>
        <SelectContent>
          {projetos.map((p: any) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleVincular} disabled={!selectedProjetoId || updateProduto.isPending}>
        Vincular
      </Button>
    </div>
  );
}
