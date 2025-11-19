import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AprovadorFormulaProps {
  versaoId: string;
  formulaId: string;
  onClose: () => void;
}

export function AprovadorFormula({
  versaoId,
  formulaId,
  onClose,
}: AprovadorFormulaProps) {
  const queryClient = useQueryClient();
  const [observacoes, setObservacoes] = useState("");
  const [acao, setAcao] = useState<"aprovar" | "rejeitar" | null>(null);

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) throw new Error("Usuário não autenticado");

      const status = acao === "aprovar" ? "aprovada" : "rejeitada";

      const { error } = await supabase
        .from("fabrica_formula_versoes")
        .update({
          status,
          aprovada_por: userId,
          data_aprovacao: new Date().toISOString(),
          motivo_alteracao: observacoes || null,
        })
        .eq("id", versaoId);

      if (error) throw error;

      // Se aprovada, ativar essa versão na fórmula
      if (acao === "aprovar") {
        await supabase
          .from("fabrica_formulas")
          .update({ ativa: true })
          .eq("id", formulaId);
      }
    },
    onSuccess: () => {
      const msg =
        acao === "aprovar"
          ? "Fórmula aprovada com sucesso!"
          : "Fórmula rejeitada";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["fabrica-formulas"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao processar aprovação");
    },
  });

  const handleAprovar = () => {
    setAcao("aprovar");
    aprovarMutation.mutate();
  };

  const handleRejeitar = () => {
    setAcao("rejeitar");
    aprovarMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aprovar Fórmula</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Atual */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div className="flex-1">
              <h4 className="font-medium">Aguardando Aprovação</h4>
              <p className="text-sm text-muted-foreground">
                Esta fórmula precisa ser aprovada antes de ser utilizada na
                produção
              </p>
            </div>
            <Badge variant="secondary">Pendente</Badge>
          </div>

          {/* Resumo da Fórmula */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Versão</p>
              <p className="font-medium">v1.0</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Data</p>
              <p className="font-medium">
                {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione comentários sobre a aprovação ou rejeição..."
              rows={4}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleRejeitar}
            disabled={aprovarMutation.isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Rejeitar
          </Button>
          <Button onClick={handleAprovar} disabled={aprovarMutation.isPending}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
