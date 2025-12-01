import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Sparkles, CheckCircle, AlertCircle } from "lucide-react";

interface ClassificarContasPagarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function ClassificarContasPagarDialog({
  open,
  onOpenChange,
  onComplete,
}: ClassificarContasPagarDialogProps) {
  const [isClassifying, setIsClassifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [classified, setClassified] = useState(0);
  const [errors, setErrors] = useState(0);

  const classificarContas = async () => {
    setIsClassifying(true);
    setProgress(0);
    setClassified(0);
    setErrors(0);

    try {
      // Buscar contas sem departamento
      const { data: contas, error: fetchError } = await supabase
        .from("contas_pagar")
        .select("*")
        .is("departamento_id", null)
        .order("data_vencimento", { ascending: false })
        .limit(100); // Limitar para não sobrecarregar

      if (fetchError) throw fetchError;

      if (!contas || contas.length === 0) {
        toast.info("Não há contas pendentes para classificar");
        onOpenChange(false);
        return;
      }

      setTotal(contas.length);

      // Classificar cada conta
      for (let i = 0; i < contas.length; i++) {
        const conta = contas[i];
        
        try {
          // Chamar edge function de classificação
          const { data: resultado, error: classifyError } = await supabase.functions.invoke(
            "classificar-conta-departamento",
            {
              body: {
                conta_codigo: conta.erp_id,
                conta_nome: conta.fornecedor_nome || "",
                conta_descricao: `${conta.tipo_documento || ""} - ${conta.numero_documento || ""}`,
                tipo_conta: "despesa",
                categoria_atual: conta.categoria_nome,
              },
            }
          );

          if (classifyError) throw classifyError;

          if (resultado?.departamento_id) {
            // Atualizar conta com departamento classificado
            const { error: updateError } = await supabase
              .from("contas_pagar")
              .update({
                departamento_id: resultado.departamento_id,
                classificado_automaticamente: true,
                confianca_classificacao: resultado.confianca,
              })
              .eq("id", conta.id);

            if (updateError) throw updateError;

            setClassified((prev) => prev + 1);
          } else {
            setErrors((prev) => prev + 1);
          }
        } catch (error: any) {
          console.error(`Erro ao classificar conta ${conta.id}:`, error);
          setErrors((prev) => prev + 1);
          
          // Se for erro de rate limit, pausar por alguns segundos
          if (error.message?.includes("rate limit") || error.message?.includes("429")) {
            toast.warning("Limite de taxa atingido, aguardando...");
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        setProgress(Math.round(((i + 1) / contas.length) * 100));
      }

      toast.success(`Classificação concluída: ${classified} contas classificadas`);
      if (errors > 0) {
        toast.warning(`${errors} contas não puderam ser classificadas`);
      }
      
      onComplete?.();
    } catch (error: any) {
      console.error("Erro na classificação:", error);
      toast.error("Erro ao classificar contas: " + error.message);
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Classificar Contas com IA
          </DialogTitle>
          <DialogDescription>
            A IA irá analisar as contas a pagar e classificá-las automaticamente nos departamentos corretos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isClassifying && total === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Clique em iniciar para classificar contas pendentes
              </p>
              <Button onClick={classificarContas} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Iniciar Classificação
              </Button>
            </div>
          )}

          {isClassifying && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">Classificadas:</span>
                  <span className="font-medium text-green-600">{classified}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-muted-foreground">Erros:</span>
                  <span className="font-medium text-amber-600">{errors}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Processando {total} contas...
              </p>
            </div>
          )}

          {!isClassifying && total > 0 && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Contas processadas</span>
                  <span className="text-sm font-bold">{total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600">Classificadas</span>
                  <span className="text-sm font-medium text-green-600">{classified}</span>
                </div>
                {errors > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-amber-600">Erros</span>
                    <span className="text-sm font-medium text-amber-600">{errors}</span>
                  </div>
                )}
              </div>
              
              <Button
                onClick={() => {
                  setTotal(0);
                  setClassified(0);
                  setErrors(0);
                  setProgress(0);
                }}
                variant="outline"
                className="w-full"
              >
                Classificar Mais Contas
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}