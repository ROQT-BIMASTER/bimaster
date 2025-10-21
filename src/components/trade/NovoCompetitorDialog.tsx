import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NovoCompetitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovoCompetitorDialog({ open, onOpenChange, onSuccess }: NovoCompetitorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    manufacturer: "",
    category: "",
    threat_level: "medio",
    market_share: "",
    is_direct_competitor: true,
    logo_url: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("competitors")
        .insert({
          name: formData.name,
          brand: formData.brand || null,
          manufacturer: formData.manufacturer || null,
          category: formData.category || null,
          threat_level: formData.threat_level,
          market_share: formData.market_share ? parseFloat(formData.market_share) : null,
          is_direct_competitor: formData.is_direct_competitor,
          logo_url: formData.logo_url || null,
          notes: formData.notes || null,
          active: true,
        });

      if (error) throw error;

      toast.success("Concorrente cadastrado com sucesso!");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: "",
        brand: "",
        manufacturer: "",
        category: "",
        threat_level: "medio",
        market_share: "",
        is_direct_competitor: true,
        logo_url: "",
        notes: "",
      });
    } catch (error: any) {
      console.error("Erro ao cadastrar concorrente:", error);
      toast.error("Erro ao cadastrar concorrente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Concorrente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome do Concorrente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Coca-Cola"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Ex: Coca-Cola"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="Ex: The Coca-Cola Company"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Refrigerantes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="threat_level">Nível de Ameaça</Label>
              <Select
                value={formData.threat_level}
                onValueChange={(value) => setFormData({ ...formData, threat_level: value })}
              >
                <SelectTrigger id="threat_level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="market_share">Market Share (%)</Label>
              <Input
                id="market_share"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.market_share}
                onChange={(e) => setFormData({ ...formData, market_share: e.target.value })}
                placeholder="Ex: 35.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url">URL do Logo</Label>
            <Input
              id="logo_url"
              type="url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://exemplo.com/logo.png"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_direct_competitor">Concorrente Direto</Label>
              <p className="text-sm text-muted-foreground">
                Marca que compete diretamente no mesmo segmento
              </p>
            </div>
            <Switch
              id="is_direct_competitor"
              checked={formData.is_direct_competitor}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_direct_competitor: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais sobre o concorrente..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar Concorrente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
