import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useProdutoBrasilChecklist, useToggleChecklistItem, useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { toast } from "sonner";

interface Props {
  produto: ProdutoBrasil;
}

export function ChecklistRegulatorio({ produto }: Props) {
  const { data: checklist = [] } = useProdutoBrasilChecklist(produto.id);
  const toggleItem = useToggleChecklistItem();
  const updateProduto = useUpdateProdutoBrasil();
  const [open, setOpen] = useState(true);

  const completedCount = checklist.filter((c) => c.concluido).length;
  const allCompleted = checklist.length > 0 && completedCount === checklist.length;

  const handleSendToRegulatorio = () => {
    updateProduto.mutate(
      { id: produto.id, status: "aguardando_regulatorio" },
      { onSuccess: () => toast.success("Enviado para regulatório!") }
    );
  };

  const handleApprove = () => {
    if (!allCompleted) {
      toast.error("Complete todos os itens do checklist antes de aprovar");
      return;
    }
    updateProduto.mutate(
      { id: produto.id, status: "aprovado_cadastro", data_aprovacao_regulatorio: new Date().toISOString().split("T")[0] },
      { onSuccess: () => toast.success("Produto aprovado para cadastro!") }
    );
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Checklist Regulatório
                <Badge variant={allCompleted ? "default" : "secondary"} className="text-[10px]">
                  {completedCount}/{checklist.length}
                </Badge>
              </CardTitle>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-1.5">
                <Checkbox
                  checked={item.concluido}
                  onCheckedChange={(checked) =>
                    toggleItem.mutate({ id: item.id, concluido: !!checked, produtoBrasilId: produto.id })
                  }
                />
                <span className={`text-sm flex-1 ${item.concluido ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.item}
                </span>
              </div>
            ))}

            {/* Campos regulatórios extras */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nº Registro</label>
                <Input
                  defaultValue={produto.numero_registro || ""}
                  onBlur={(e) => updateProduto.mutate({ id: produto.id, numero_registro: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status ANVISA</label>
                <Input
                  defaultValue={produto.status_anvisa || ""}
                  onBlur={(e) => updateProduto.mutate({ id: produto.id, status_anvisa: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoria Regulatória</label>
                <Input
                  defaultValue={produto.categoria_regulatoria || ""}
                  onBlur={(e) => updateProduto.mutate({ id: produto.id, categoria_regulatoria: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Responsável Técnico</label>
                <Input
                  defaultValue={produto.responsavel_tecnico || ""}
                  onBlur={(e) => updateProduto.mutate({ id: produto.id, responsavel_tecnico: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-3">
              {produto.status === "precadastro_em_andamento" && (
                <Button onClick={handleSendToRegulatorio} variant="outline" className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para Regulatório
                </Button>
              )}
              {produto.status === "aguardando_regulatorio" && (
                <Button onClick={handleApprove} variant="default" className="flex-1" disabled={!allCompleted}>
                  <Shield className="h-4 w-4 mr-2" />
                  Aprovar Produto
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
