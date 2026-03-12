import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProdutoBrasilCusto } from "@/hooks/useProdutoBrasil";

interface Props {
  produtoBrasilId: string;
  produtoNome: string;
}

export function FichaCustoImportado({ produtoBrasilId, produtoNome }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: custo, isLoading } = useQuery({
    queryKey: ["produto-brasil-custo", produtoBrasilId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil_custos" as any)
        .select("*")
        .eq("produto_brasil_id", produtoBrasilId)
        .maybeSingle() as any);
      if (error) throw error;
      return data as ProdutoBrasilCusto | null;
    },
  });

  const [form, setForm] = useState({
    custo_nf: "",
    custo_servico: "",
    custo_condicao: "",
    custo_base_tipo: "nf_servico",
    markup_tipo: "percentual",
    markup_valor: "",
    impostos_percentual: "",
    frete_valor: "",
    observacoes: "",
  });

  useEffect(() => {
    if (custo) {
      setForm({
        custo_nf: custo.custo_nf?.toString() || "0",
        custo_servico: custo.custo_servico?.toString() || "0",
        custo_condicao: custo.custo_condicao?.toString() || "0",
        custo_base_tipo: custo.custo_base_tipo || "nf_servico",
        markup_tipo: custo.markup_tipo || "percentual",
        markup_valor: custo.markup_valor?.toString() || "0",
        impostos_percentual: custo.impostos_percentual?.toString() || "0",
        frete_valor: custo.frete_valor?.toString() || "0",
        observacoes: custo.observacoes || "",
      });
    }
  }, [custo]);

  // Calculate derived values
  const custoNf = parseFloat(form.custo_nf) || 0;
  const custoServico = parseFloat(form.custo_servico) || 0;
  const custoCondicao = parseFloat(form.custo_condicao) || 0;
  const custoBase = form.custo_base_tipo === "nf_servico" ? custoNf + custoServico : custoNf + custoServico + custoCondicao;
  const markupValor = parseFloat(form.markup_valor) || 0;
  const impostosPerc = parseFloat(form.impostos_percentual) || 0;
  const freteValor = parseFloat(form.frete_valor) || 0;

  let precoSugerido = custoBase;
  if (form.markup_tipo === "percentual") {
    precoSugerido = custoBase * (1 + markupValor / 100);
  } else {
    precoSugerido = custoBase * markupValor;
  }
  const impostoValor = precoSugerido * (impostosPerc / 100);
  const precoFinal = precoSugerido + impostoValor + freteValor;
  const margem = precoFinal > 0 ? ((precoFinal - custoBase - freteValor) / precoFinal) * 100 : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        produto_brasil_id: produtoBrasilId,
        custo_nf: custoNf,
        custo_servico: custoServico,
        custo_condicao: custoCondicao,
        custo_base_tipo: form.custo_base_tipo,
        markup_tipo: form.markup_tipo,
        markup_valor: markupValor,
        impostos_percentual: impostosPerc,
        frete_valor: freteValor,
        margem_contribuicao: margem,
        preco_sugerido: precoFinal,
        observacoes: form.observacoes || null,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      if (custo?.id) {
        const { error } = await (supabase
          .from("produtos_brasil_custos" as any)
          .update(payload)
          .eq("id", custo.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("produtos_brasil_custos" as any)
          .insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto-brasil-custo", produtoBrasilId] });
      toast.success("Ficha de custos salva!");
    },
    onError: () => toast.error("Erro ao salvar ficha de custos"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Ficha de Custos — {produtoNome}
          </CardTitle>
          <Badge variant={custo ? "default" : "secondary"} className="text-[10px]">
            {custo ? custo.status : "Não iniciada"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Custo NF (R$)</Label>
            <Input type="number" step="0.0001" value={form.custo_nf} onChange={(e) => setForm({ ...form, custo_nf: e.target.value })} className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">Custo Serviço (R$)</Label>
            <Input type="number" step="0.0001" value={form.custo_servico} onChange={(e) => setForm({ ...form, custo_servico: e.target.value })} className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">Custo Condição (R$)</Label>
            <Input type="number" step="0.0001" value={form.custo_condicao} onChange={(e) => setForm({ ...form, custo_condicao: e.target.value })} className="mt-1 font-mono" />
          </div>
        </div>

        {/* Base & Markup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Base de Cálculo</Label>
            <Select value={form.custo_base_tipo} onValueChange={(v) => setForm({ ...form, custo_base_tipo: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nf_servico">NF + Serviço</SelectItem>
                <SelectItem value="nf_servico_condicao">NF + Serviço + Condição</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo Markup</Label>
            <Select value={form.markup_tipo} onValueChange={(v) => setForm({ ...form, markup_tipo: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
                <SelectItem value="multiplicador">Multiplicador (x)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Markup ({form.markup_tipo === "percentual" ? "%" : "x"})</Label>
            <Input type="number" step="0.01" value={form.markup_valor} onChange={(e) => setForm({ ...form, markup_valor: e.target.value })} className="mt-1 font-mono" />
          </div>
        </div>

        {/* Taxes & Freight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Impostos (%)</Label>
            <Input type="number" step="0.01" value={form.impostos_percentual} onChange={(e) => setForm({ ...form, impostos_percentual: e.target.value })} className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">Frete (R$)</Label>
            <Input type="number" step="0.01" value={form.frete_valor} onChange={(e) => setForm({ ...form, frete_valor: e.target.value })} className="mt-1 font-mono" />
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Custo Base</span>
            <span className="font-mono font-bold">R$ {custoBase.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Preço c/ Markup</span>
            <span className="font-mono">R$ {precoSugerido.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Impostos</span>
            <span className="font-mono">R$ {impostoValor.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Frete</span>
            <span className="font-mono">R$ {freteValor.toFixed(4)}</span>
          </div>
          <div className="border-t border-primary/20 pt-2 flex justify-between text-sm font-bold">
            <span>Preço Final Sugerido</span>
            <span className="font-mono text-primary">R$ {precoFinal.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Margem de Contribuição</span>
            <span className="font-mono">{margem.toFixed(2)}%</span>
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="mt-1" />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Ficha de Custos
        </Button>
      </CardContent>
    </Card>
  );
}
