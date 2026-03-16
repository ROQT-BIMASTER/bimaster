import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link2, Plus, Trash2, FileCheck, ClipboardList, FolderKanban, Package, Loader2 } from "lucide-react";
import { useFluxoVinculos, useCreateFluxoVinculo, useDeleteFluxoVinculo, type FluxoVinculo } from "@/hooks/useFluxoAprovacaoArtes";
import { useNavigate } from "react-router-dom";

const TIPO_VINCULO_MAP: Record<string, { label: string; icon: any; color: string }> = {
  checklist: { label: "Checklist China", icon: ClipboardList, color: "text-orange-500" },
  documento_china: { label: "Documento China", icon: FileCheck, color: "text-blue-500" },
  tarefa: { label: "Tarefa do Projeto", icon: FolderKanban, color: "text-green-500" },
  secao: { label: "Seção do Projeto", icon: FolderKanban, color: "text-purple-500" },
  submissao: { label: "Submissão China", icon: Package, color: "text-red-500" },
};

export function FluxoVinculosPanel({ instanciaId, readOnly }: {
  instanciaId: string; readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { data: vinculos = [], isLoading } = useFluxoVinculos(instanciaId);
  const createVinculo = useCreateFluxoVinculo();
  const deleteVinculo = useDeleteFluxoVinculo();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ tipo_vinculo: "submissao", ref_id: "", ref_label: "" });

  const handleCreate = () => {
    if (!form.ref_id.trim() || !form.ref_label.trim()) return;
    createVinculo.mutate({
      instancia_id: instanciaId,
      tipo_vinculo: form.tipo_vinculo,
      ref_id: form.ref_id,
      ref_label: form.ref_label,
    }, {
      onSuccess: () => {
        setShowDialog(false);
        setForm({ tipo_vinculo: "submissao", ref_id: "", ref_label: "" });
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Vínculos com Módulos
            <Badge variant="outline" className="text-[10px]">{vinculos.length}</Badge>
          </CardTitle>
          {!readOnly && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowDialog(true)}>
              <Plus className="h-3 w-3" />Vincular
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : vinculos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhum vínculo. Vincule checklists, documentos, tarefas ou submissões.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {vinculos.map(v => {
              const meta = TIPO_VINCULO_MAP[v.tipo_vinculo] || TIPO_VINCULO_MAP.submissao;
              const Icon = meta.icon;
              return (
                <div key={v.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-muted/30 group">
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                  <span className="text-xs font-medium">{v.ref_label}</span>
                  <Badge variant="outline" className="text-[8px] px-1">{meta.label}</Badge>
                  {!readOnly && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
                          <AlertDialogDescription>O vínculo com "{v.ref_label}" será removido.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteVinculo.mutate(v.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Item ao Fluxo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo de Vínculo</Label>
                <Select value={form.tipo_vinculo} onValueChange={v => setForm(p => ({ ...p, tipo_vinculo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_VINCULO_MAP).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Identificador (ID ou código)</Label>
                <Input
                  value={form.ref_id}
                  onChange={e => setForm(p => ({ ...p, ref_id: e.target.value }))}
                  placeholder="ID do item referenciado"
                />
              </div>
              <div>
                <Label>Descrição / Label</Label>
                <Input
                  value={form.ref_label}
                  onChange={e => setForm(p => ({ ...p, ref_label: e.target.value }))}
                  placeholder="Ex: Checklist Rotulagem - Batom Rose"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleCreate}
                disabled={!form.ref_id.trim() || !form.ref_label.trim() || createVinculo.isPending}
              >
                {createVinculo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
