import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, ArrowRight, TrendingUp, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  formatarMoeda,
  calcularMargemLucro,
  reverseMarkup,
  formatarMarkupLabel,
} from "@/lib/fabrica/pricing-calculator";

export interface ReversePrecoDialogData {
  produtoId: string;
  produtoNome: string;
  tabelaId: string;
  tabelaNome: string;
  tipoMarkup: 'percentual' | 'multiplicador' | 'valor_fixo';
  custoBase: number;
  precoAtual: number;
  margemAtual: number;
}

interface ReversePrecoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReversePrecoDialogData | null;
  onSaved: () => void;
}

export function ReversePrecoDialog({ open, onOpenChange, data, onSaved }: ReversePrecoDialogProps) {
  const [novoPreco, setNovoPreco] = useState("");
  const [saving, setSaving] = useState(false);

  const novoPrecoNum = useMemo(() => {
    const val = novoPreco.replace(/[^\d.,]/g, "").replace(",", ".");
    return parseFloat(val) || 0;
  }, [novoPreco]);

  const markupCalculado = useMemo(() => {
    if (!data || data.custoBase <= 0 || novoPrecoNum <= 0) return null;
    return reverseMarkup(data.custoBase, novoPrecoNum, data.tipoMarkup);
  }, [data, novoPrecoNum]);

  const margemResultante = useMemo(() => {
    if (!data || novoPrecoNum <= 0 || data.custoBase <= 0) return 0;
    return calcularMargemLucro(data.custoBase, novoPrecoNum);
  }, [data, novoPrecoNum]);

  const markupAtual = useMemo(() => {
    if (!data || data.custoBase <= 0) return 0;
    return reverseMarkup(data.custoBase, data.precoAtual, data.tipoMarkup);
  }, [data]);

  const handleSalvar = async () => {
    if (!data || markupCalculado === null) return;

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Upsert override for this product+table
      const { error } = await supabase
        .from("fabrica_markup_overrides")
        .upsert(
          {
            tabela_id: data.tabelaId,
            produto_id: data.produtoId,
            tipo_markup: data.tipoMarkup,
            valor_markup: markupCalculado,
            ativo: true,
            created_by: user.user?.id || null,
          },
          { onConflict: "tabela_id,produto_id" }
        );

      if (error) {
        // If upsert on conflict fails, try delete+insert
        if (error.code === "23505" || error.message?.includes("unique")) {
          await supabase
            .from("fabrica_markup_overrides")
            .update({
              tipo_markup: data.tipoMarkup,
              valor_markup: markupCalculado,
              ativo: true,
              created_by: user.user?.id || null,
            })
            .eq("tabela_id", data.tabelaId)
            .eq("produto_id", data.produtoId);
        } else {
          throw error;
        }
      }

      toast.success(`Preço ajustado para ${formatarMoeda(novoPrecoNum)}`);
      setNovoPreco("");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error("Erro ao salvar override:", err);
      toast.error("Erro ao salvar ajuste de preço");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setNovoPreco("");
    onOpenChange(v);
  };

  if (!data) return null;

  const tipoLabel = data.tipoMarkup === "percentual" ? "Percentual" : data.tipoMarkup === "multiplicador" ? "Multiplicador" : "Valor Fixo";
  const variacao = novoPrecoNum > 0 ? novoPrecoNum - data.precoAtual : 0;
  const variacaoPercent = data.precoAtual > 0 && novoPrecoNum > 0 ? ((novoPrecoNum - data.precoAtual) / data.precoAtual) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Ajustar Preço
          </DialogTitle>
          <DialogDescription>
            {data.produtoNome} — {data.tabelaNome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info atual */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg text-sm">
            <div>
              <span className="text-muted-foreground">Custo Base</span>
              <p className="font-semibold">{formatarMoeda(data.custoBase)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Preço Atual</span>
              <p className="font-semibold">{formatarMoeda(data.precoAtual)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Markup Atual ({tipoLabel})</span>
              <p className="font-medium">{formatarMarkupLabel(markupAtual, data.tipoMarkup)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Margem Atual</span>
              <p className="font-medium">{data.margemAtual.toFixed(1)}%</p>
            </div>
          </div>

          <Separator />

          {/* Input novo preço */}
          <div className="space-y-2">
            <Label htmlFor="novo-preco">Novo Preço Desejado</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                id="novo-preco"
                placeholder="0,00"
                value={novoPreco}
                onChange={(e) => setNovoPreco(e.target.value)}
                className="pl-10 text-lg font-semibold"
                autoFocus
              />
            </div>
          </div>

          {/* Preview do cálculo */}
          {novoPrecoNum > 0 && markupCalculado !== null && (
            <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Markup calculado ({tipoLabel}):</span>
                <Badge variant="secondary" className="font-mono">
                  {formatarMarkupLabel(markupCalculado, data.tipoMarkup)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Margem resultante:</span>
                <Badge
                  variant={margemResultante <= 0 ? "destructive" : margemResultante < 15 ? "outline" : "default"}
                  className="font-mono"
                >
                  {margemResultante.toFixed(1)}%
                </Badge>
              </div>
              {variacao !== 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground ml-6">Variação:</span>
                  <span className={`font-medium ${variacao > 0 ? "text-green-600" : "text-destructive"}`}>
                    {variacao > 0 ? "+" : ""}{formatarMoeda(variacao)} ({variacaoPercent > 0 ? "+" : ""}{variacaoPercent.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={saving || novoPrecoNum <= 0 || markupCalculado === null}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
