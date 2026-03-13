import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, FileText, Send, Clock, CheckCircle2 } from "lucide-react";
import { ANVISA_PIPELINE_LABELS, useUpdateProdutoBrasil, type ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useState, useEffect } from "react";

const ANVISA_STEPS = [
  { key: "analise_regulatoria", icon: FileText },
  { key: "dossie_em_elaboracao", icon: FileText },
  { key: "enviado_anvisa", icon: Send },
  { key: "em_aprovacao", icon: Clock },
  { key: "aprovado", icon: CheckCircle2 },
];

export function TabAnvisaPipeline({ produto }: { produto: ProdutoBrasil }) {
  const updateProduto = useUpdateProdutoBrasil();
  const currentStatus = produto.anvisa_pipeline_status || "analise_regulatoria";
  const currentIndex = ANVISA_STEPS.findIndex((s) => s.key === currentStatus);

  const [processo, setProcesso] = useState(produto.processo_anvisa || "");
  const [dataEnvio, setDataEnvio] = useState(produto.anvisa_data_envio || "");
  const [dataAprov, setDataAprov] = useState(produto.anvisa_data_aprovacao || "");
  const [taxaPaga, setTaxaPaga] = useState(produto.anvisa_taxa_paga || false);
  const [obs, setObs] = useState(produto.anvisa_observacoes || "");

  useEffect(() => {
    setProcesso(produto.processo_anvisa || "");
    setDataEnvio(produto.anvisa_data_envio || "");
    setDataAprov(produto.anvisa_data_aprovacao || "");
    setTaxaPaga(produto.anvisa_taxa_paga || false);
    setObs(produto.anvisa_observacoes || "");
  }, [produto]);

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      processo_anvisa: processo || null,
      anvisa_data_envio: dataEnvio || null,
      anvisa_data_aprovacao: dataAprov || null,
      anvisa_taxa_paga: taxaPaga,
      anvisa_observacoes: obs || null,
    });
  };

  const handleAdvanceStatus = () => {
    if (currentIndex < ANVISA_STEPS.length - 1) {
      updateProduto.mutate({
        id: produto.id,
        anvisa_pipeline_status: ANVISA_STEPS[currentIndex + 1].key,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* ANVISA Pipeline visual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Pipeline ANVISA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {ANVISA_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div key={step.key} className="flex items-center gap-1">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                      isCurrent && "bg-primary text-primary-foreground shadow-sm",
                      isPast && "bg-success/15 text-success",
                      !isPast && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {ANVISA_PIPELINE_LABELS[step.key]}
                  </div>
                  {idx < ANVISA_STEPS.length - 1 && (
                    <div className={cn("w-6 h-0.5 rounded-full", isPast ? "bg-success" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
          {currentIndex < ANVISA_STEPS.length - 1 && (
            <Button size="sm" onClick={handleAdvanceStatus} className="mt-3" disabled={updateProduto.isPending}>
              Avançar para: {ANVISA_PIPELINE_LABELS[ANVISA_STEPS[currentIndex + 1]?.key]}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ANVISA Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dados ANVISA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nº Processo ANVISA</Label>
              <Input value={processo} onChange={(e) => setProcesso(e.target.value)} placeholder="Ex: 25351.123456/2024-01" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de Envio</Label>
              <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de Aprovação</Label>
              <Input type="date" value={dataAprov} onChange={(e) => setDataAprov(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox checked={taxaPaga} onCheckedChange={(v) => setTaxaPaga(!!v)} />
              <span className="text-sm">Taxa ANVISA paga</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações Regulatórias</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Notas sobre o processo..." />
          </div>
          <Button size="sm" onClick={handleSave} disabled={updateProduto.isPending}>
            Salvar Dados ANVISA
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
