import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ComparadorVersoesProps {
  versaoAntiga: any;
  versaoNova: any;
  onClose: () => void;
}

export function ComparadorVersoes({
  versaoAntiga,
  versaoNova,
  onClose,
}: ComparadorVersoesProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comparação de Versões</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Versão Anterior
                </span>
                <Badge variant="secondary">v{versaoAntiga?.versao}</Badge>
              </div>
              <p className="text-sm">
                {new Date(versaoAntiga?.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Versão Nova
                </span>
                <Badge>v{versaoNova?.versao}</Badge>
              </div>
              <p className="text-sm">
                {new Date(versaoNova?.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Alterações */}
          <div>
            <h3 className="font-semibold mb-3">Alterações de Ingredientes</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
                    <TableHead className="text-right">Nova</TableHead>
                    <TableHead className="text-center">Alteração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">
                        Funcionalidade de comparação detalhada em desenvolvimento
                      </p>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Justificativa */}
          {versaoNova?.motivo_alteracao && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Motivo da Alteração</h4>
              <p className="text-sm text-muted-foreground">
                {versaoNova.motivo_alteracao}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
