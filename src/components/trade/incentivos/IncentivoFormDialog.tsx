import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCreateIncentivo, useUpdateIncentivo, type TradeIncentivo } from "@/hooks/useTradeIncentivos";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editIncentivo?: TradeIncentivo | null;
}

const TIPOS = [
  { value: "visitas", label: "Meta de Visitas", icon: "📍" },
  { value: "fotos", label: "Meta de Fotos", icon: "📸" },
  { value: "vendas", label: "Meta de Vendas", icon: "💰" },
  { value: "ranking", label: "Ranking da Equipe", icon: "🏆" },
  { value: "bonus", label: "Bônus Especial", icon: "🎁" },
];

export function IncentivoFormDialog({ open, onOpenChange, editIncentivo }: Props) {
  const createIncentivo = useCreateIncentivo();
  const updateIncentivo = useUpdateIncentivo();

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "visitas",
    meta_valor: 0,
    meta_unidade: "unidades",
    recompensa: "",
    icone: "🎯",
    data_inicio: weekStart,
    data_fim: weekEnd,
    ativo: true,
  });

  useEffect(() => {
    if (editIncentivo) {
      setForm({
        titulo: editIncentivo.titulo,
        descricao: editIncentivo.descricao || "",
        tipo: editIncentivo.tipo,
        meta_valor: editIncentivo.meta_valor,
        meta_unidade: editIncentivo.meta_unidade,
        recompensa: editIncentivo.recompensa || "",
        icone: editIncentivo.icone,
        data_inicio: editIncentivo.data_inicio,
        data_fim: editIncentivo.data_fim,
        ativo: editIncentivo.ativo,
      });
    } else {
      setForm({
        titulo: "",
        descricao: "",
        tipo: "visitas",
        meta_valor: 0,
        meta_unidade: "unidades",
        recompensa: "",
        icone: "🎯",
        data_inicio: weekStart,
        data_fim: weekEnd,
        ativo: true,
      });
    }
  }, [editIncentivo, open]);

  const handleSubmit = async () => {
    if (!form.titulo) {
      toast.error("Preencha o título");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...form, created_by: user?.id || null };

    if (editIncentivo) {
      await updateIncentivo.mutateAsync({ id: editIncentivo.id, ...payload });
    } else {
      await createIncentivo.mutateAsync(payload as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editIncentivo ? "Editar Incentivo" : "Criar Incentivo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder='Ex: "Meta PDV — Semana 12"' />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => {
                const t = TIPOS.find(t => t.value === v);
                setForm(f => ({ ...f, tipo: v, icone: t?.icon || f.icone }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ícone/Emoji</Label>
              <Input value={form.icone} onChange={e => setForm(f => ({ ...f, icone: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Meta (valor)</Label>
              <Input type="number" value={form.meta_valor} onChange={e => setForm(f => ({ ...f, meta_valor: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.meta_unidade} onChange={e => setForm(f => ({ ...f, meta_unidade: e.target.value }))} placeholder="Ex: PDVs, fotos, R$" />
            </div>
          </div>

          <div>
            <Label>Recompensa</Label>
            <Input value={form.recompensa} onChange={e => setForm(f => ({ ...f, recompensa: e.target.value }))} placeholder='Ex: "R$50 de bônus", "Day off"' />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            <Label>Ativo</Label>
          </div>

          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white hover:brightness-110" disabled={createIncentivo.isPending || updateIncentivo.isPending}>
            {editIncentivo ? "Salvar Alterações" : "Criar Incentivo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
