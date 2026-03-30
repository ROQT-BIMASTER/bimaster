import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { useOmsCondicoesPagamento, useOmsCondicaoPagamentoMutations, type OmsCondicaoPagamento } from "@/hooks/useOmsPedidos";

export default function OmsCondicoesPagamento() {
  const { data: condicoes, isLoading } = useOmsCondicoesPagamento();
  const { create, update } = useOmsCondicaoPagamentoMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OmsCondicaoPagamento | null>(null);
  const [form, setForm] = useState({ codigo: "", descricao: "", parcelas: 1, dias_entre_parcelas: 30, dias_primeira_parcela: 0, ativo: true });

  const resetForm = () => {
    setForm({ codigo: "", descricao: "", parcelas: 1, dias_entre_parcelas: 30, dias_primeira_parcela: 0, ativo: true });
    setEditing(null);
  };

  const handleEdit = (c: OmsCondicaoPagamento) => {
    setEditing(c);
    setForm({ codigo: c.codigo, descricao: c.descricao, parcelas: c.parcelas, dias_entre_parcelas: c.dias_entre_parcelas, dias_primeira_parcela: c.dias_primeira_parcela, ativo: c.ativo });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...form });
    } else {
      await create.mutateAsync(form);
    }
    setOpen(false);
    resetForm();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Condições de Pagamento"
          description="Cadastro de condições de pagamento para pedidos OMS"
          backTo="/dashboard/oms"
          backLabel="Voltar ao OMS"
          actions={
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova Condição</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar" : "Nova"} Condição de Pagamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Código</Label>
                      <Input value={form.codigo} onChange={(e) => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="30-60-90" disabled={!!editing} />
                    </div>
                    <div>
                      <Label>Parcelas</Label>
                      <Input type="number" value={form.parcelas} onChange={(e) => setForm(f => ({ ...f, parcelas: parseInt(e.target.value) || 1 }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="30/60/90 dias" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Dias entre parcelas</Label>
                      <Input type="number" value={form.dias_entre_parcelas} onChange={(e) => setForm(f => ({ ...f, dias_entre_parcelas: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <Label>Dias 1ª parcela</Label>
                      <Input type="number" value={form.dias_primeira_parcela} onChange={(e) => setForm(f => ({ ...f, dias_primeira_parcela: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                    <Label>Ativo</Label>
                  </div>
                  <Button className="w-full" onClick={handleSubmit} disabled={!form.codigo || !form.descricao || create.isPending || update.isPending}>
                    {create.isPending || update.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-center">Dias entre</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !condicoes?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma condição cadastrada</TableCell></TableRow>
                ) : (
                  condicoes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{c.codigo}</TableCell>
                      <TableCell>{c.descricao}</TableCell>
                      <TableCell className="text-center">{c.parcelas}x</TableCell>
                      <TableCell className="text-center">{c.dias_entre_parcelas} dias</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
