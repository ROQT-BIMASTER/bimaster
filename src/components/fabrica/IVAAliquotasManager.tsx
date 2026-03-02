import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface TaxRateIVA {
  id: string;
  nome_regra: string;
  aliquota_cbs: number;
  aliquota_ibs: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
}

export function IVAAliquotasManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_regra: "",
    aliquota_cbs: "",
    aliquota_ibs: "",
    data_inicio: "",
    data_fim: "",
    ativo: true,
  });

  const { data: taxRates, isLoading } = useQuery({
    queryKey: ["fabrica-tax-rates-iva"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tax_rates_iva")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as TaxRateIVA[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        nome_regra: form.nome_regra,
        aliquota_cbs: parseFloat(form.aliquota_cbs),
        aliquota_ibs: parseFloat(form.aliquota_ibs),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        ativo: form.ativo,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from("fabrica_tax_rates_iva")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fabrica_tax_rates_iva")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-tax-rates-iva"] });
      toast.success(editingId ? "Alíquota atualizada!" : "Alíquota cadastrada!");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fabrica_tax_rates_iva")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-tax-rates-iva"] });
      toast.success("Alíquota removida!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ nome_regra: "", aliquota_cbs: "", aliquota_ibs: "", data_inicio: "", data_fim: "", ativo: true });
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (rate: TaxRateIVA) => {
    setForm({
      nome_regra: rate.nome_regra,
      aliquota_cbs: rate.aliquota_cbs.toString(),
      aliquota_ibs: rate.aliquota_ibs.toString(),
      data_inicio: rate.data_inicio,
      data_fim: rate.data_fim || "",
      ativo: rate.ativo,
    });
    setEditingId(rate.id);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Alíquotas CBS/IBS</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova Alíquota</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Nova"} Alíquota IVA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da Regra *</Label>
                <Input value={form.nome_regra} onChange={(e) => setForm({ ...form, nome_regra: e.target.value })} placeholder="Ex: Alíquota padrão 2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Alíquota CBS (%) *</Label>
                  <Input type="number" step="0.01" value={form.aliquota_cbs} onChange={(e) => setForm({ ...form, aliquota_cbs: e.target.value })} />
                </div>
                <div>
                  <Label>Alíquota IBS (%) *</Label>
                  <Input type="number" step="0.01" value={form.aliquota_ibs} onChange={(e) => setForm({ ...form, aliquota_ibs: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início *</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Ativa</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.nome_regra || !form.aliquota_cbs || !form.data_inicio}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !taxRates?.length ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma alíquota cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regra</TableHead>
                <TableHead>CBS (%)</TableHead>
                <TableHead>IBS (%)</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome_regra}</TableCell>
                  <TableCell>{r.aliquota_cbs}%</TableCell>
                  <TableCell>{r.aliquota_ibs}%</TableCell>
                  <TableCell>{new Date(r.data_inicio).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{r.data_fim ? new Date(r.data_fim).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
