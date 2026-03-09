import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatLocalDate } from "@/utils/dateUtils";

interface QuickDueDateChangeProps {
  paymentQueueId: string;
  currentDueDate: string;
  code: string;
  onChanged?: () => void;
}

export function QuickDueDateChange({ paymentQueueId, currentDueDate, code, onChanged }: QuickDueDateChangeProps) {
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState(currentDueDate);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setNewDate(currentDueDate);
      setMotivo("");
    }
    setOpen(isOpen);
  };

  const handleSave = async () => {
    if (!newDate) {
      toast.error("Selecione a nova data de vencimento.");
      return;
    }
    if (newDate === currentDueDate) {
      toast.error("A data informada é igual à atual.");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Informe o motivo da alteração.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userName = "Usuário";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.nome) userName = profile.nome;
      }

      const { error } = await supabase
        .from("financial_payment_queue")
        .update({ due_date: newDate })
        .eq("id", paymentQueueId);

      if (error) throw error;

      // Log history
      await supabase.from("financial_payment_queue_history").insert({
        payment_queue_id: paymentQueueId,
        changed_by: user?.id || null,
        changed_by_name: userName,
        action: "due_date_changed",
        snapshot: { motivo },
        changes: {
          due_date: {
            old: currentDueDate,
            new: newDate,
          },
        },
      });

      toast.success("Data de vencimento alterada com sucesso.");
      setOpen(false);
      onChanged?.();
    } catch (err: any) {
      toast.error("Erro ao alterar data: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Alterar vencimento">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 space-y-3" align="start">
        <div>
          <Label className="text-xs font-semibold">Alterar Vencimento</Label>
          <p className="text-xs text-muted-foreground">
            Atual: {formatLocalDate(currentDueDate, "dd/MM/yyyy")}
          </p>
        </div>
        <div>
          <Label className="text-xs">Nova data</Label>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Motivo da alteração *</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Renegociação com fornecedor..."
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Salvar Alteração
        </Button>
      </PopoverContent>
    </Popover>
  );
}
