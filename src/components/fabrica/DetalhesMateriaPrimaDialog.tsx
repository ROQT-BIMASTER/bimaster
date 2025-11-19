import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DetalhesMateriaPrimaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiaPrima: any;
}

const statusColors = {
  disponivel: "default" as const,
  quarentena: "secondary" as const,
  bloqueado: "destructive" as const,
};

const statusLabels = {
  disponivel: "Disponível",
  quarentena: "Quarentena",
  bloqueado: "Bloqueado",
};

export function DetalhesMateriaPrimaDialog({
  open,
  onOpenChange,
  materiaPrima,
}: DetalhesMateriaPrimaDialogProps) {
  if (!materiaPrima) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Matéria-Prima</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Código</p>
              <p className="font-mono font-medium">{materiaPrima.codigo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Badge variant={statusColors[materiaPrima.status as keyof typeof statusColors]}>
                {statusLabels[materiaPrima.status as keyof typeof statusLabels]}
              </Badge>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Nome</p>
              <p className="font-semibold text-lg">{materiaPrima.nome}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Categoria</p>
              <p className="font-medium">{materiaPrima.categoria?.nome || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Fornecedor</p>
              <p className="font-medium">{materiaPrima.fornecedor?.razao_social || "-"}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Informações de Estoque</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Estoque Atual</p>
                <p className="font-medium text-lg">
                  {materiaPrima.estoque_atual?.toFixed(3)} {materiaPrima.unidade_medida?.sigla}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Estoque Mínimo</p>
                <p className="font-medium">
                  {materiaPrima.estoque_minimo?.toFixed(3)} {materiaPrima.unidade_medida?.sigla}
                </p>
                {materiaPrima.estoque_atual < materiaPrima.estoque_minimo && (
                  <p className="text-xs text-destructive mt-1">⚠️ Estoque abaixo do mínimo</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Custo Unitário</p>
                <p className="font-medium">
                  R$ {materiaPrima.custo_unitario?.toFixed(2)} / {materiaPrima.unidade_medida?.sigla}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                <p className="font-medium text-lg">
                  R${" "}
                  {(materiaPrima.estoque_atual * materiaPrima.custo_unitario || 0).toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 2 }
                  )}
                </p>
              </div>
            </div>
          </div>

          {(materiaPrima.data_validade || materiaPrima.lote) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Rastreabilidade</h4>
                <div className="grid grid-cols-2 gap-4">
                  {materiaPrima.lote && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Lote</p>
                      <p className="font-medium">{materiaPrima.lote}</p>
                    </div>
                  )}
                  {materiaPrima.data_validade && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Validade</p>
                      <p className="font-medium">
                        {format(new Date(materiaPrima.data_validade), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {materiaPrima.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Observações</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {materiaPrima.observacoes}
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
