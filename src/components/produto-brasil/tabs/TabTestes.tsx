import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FlaskConical, Plus } from "lucide-react";
import {
  useProdutoTestes,
  useCreateTeste,
  useUpdateTeste,
  TIPO_TESTE_LABELS,
  TESTE_STATUS_LABELS,
  type ProdutoTeste,
} from "@/hooks/useProdutoBrasil";

const STATUS_COLORS: Record<string, string> = {
  amostra_solicitada: "bg-muted text-muted-foreground",
  amostra_recebida: "bg-blue-500/15 text-blue-600",
  em_teste: "bg-warning/15 text-warning",
  aprovada: "bg-success/15 text-success",
  reprovada: "bg-destructive/15 text-destructive",
  ajuste_solicitado: "bg-orange-500/15 text-orange-600",
};

export function TabTestes({ produtoBrasilId }: { produtoBrasilId: string }) {
  const { data: testes = [], isLoading } = useProdutoTestes(produtoBrasilId);
  const createTeste = useCreateTeste();
  const updateTeste = useUpdateTeste();
  const [showDialog, setShowDialog] = useState(false);
  const [newTipo, setNewTipo] = useState("cor");
  const [newObs, setNewObs] = useState("");
  const [newLote, setNewLote] = useState("");
  const [newFornecedor, setNewFornecedor] = useState("");

  const handleCreate = async () => {
    await createTeste.mutateAsync({
      produto_brasil_id: produtoBrasilId,
      tipo_teste: newTipo,
      observacoes: newObs || undefined,
      lote: newLote || undefined,
      fornecedor: newFornecedor || undefined,
    });
    setShowDialog(false);
    setNewObs("");
    setNewLote("");
    setNewFornecedor("");
  };

  const handleStatusChange = (teste: ProdutoTeste, newStatus: string) => {
    updateTeste.mutate({
      id: teste.id,
      produtoBrasilId,
      status: newStatus,
      ...(newStatus === "aprovada" || newStatus === "reprovada"
        ? { data_resultado: new Date().toISOString() }
        : {}),
      ...(newStatus === "amostra_recebida"
        ? { data_recebimento: new Date().toISOString() }
        : {}),
    });
  };

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando testes...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Testes e Amostras
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Novo Teste
        </Button>
      </div>

      {testes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum teste registrado. Clique em "Novo Teste" para solicitar uma amostra.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {testes.map((teste) => (
            <Card key={teste.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {TIPO_TESTE_LABELS[teste.tipo_teste] || teste.tipo_teste}
                  </CardTitle>
                  <Badge variant="outline" className={STATUS_COLORS[teste.status]}>
                    {TESTE_STATUS_LABELS[teste.status] || teste.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {teste.lote && <p><span className="font-medium text-foreground">Lote:</span> {teste.lote}</p>}
                {teste.fornecedor && <p><span className="font-medium text-foreground">Fornecedor:</span> {teste.fornecedor}</p>}
                {teste.observacoes && <p>{teste.observacoes}</p>}
                {teste.resultado && (
                  <p><span className="font-medium text-foreground">Resultado:</span> {teste.resultado}</p>
                )}
                <div className="pt-2">
                  <Select value={teste.status} onValueChange={(v) => handleStatusChange(teste, v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TESTE_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Teste / Amostra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Teste</Label>
              <Select value={newTipo} onValueChange={setNewTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_TESTE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Lote (opcional)</Label>
                <Input value={newLote} onChange={(e) => setNewLote(e.target.value)} placeholder="Ex: L2024-001" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor (opcional)</Label>
                <Input value={newFornecedor} onChange={(e) => setNewFornecedor(e.target.value)} placeholder="Nome" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={newObs} onChange={(e) => setNewObs(e.target.value)} rows={2} placeholder="Detalhes da solicitação..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createTeste.isPending}>
              {createTeste.isPending ? "Criando..." : "Solicitar Amostra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
