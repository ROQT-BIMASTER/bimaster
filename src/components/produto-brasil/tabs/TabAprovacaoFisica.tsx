import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertTriangle, Plus } from "lucide-react";
import {
  useAprovacaoFisica,
  useProdutoRNCs,
  useCreateAprovacaoFisica,
  useCreateRNC,
} from "@/hooks/useProdutoBrasil";

const CONFORMIDADE_ITEMS = [
  { key: "cor_conforme", label: "Cor conforme" },
  { key: "textura_conforme", label: "Textura conforme" },
  { key: "fragrancia_conforme", label: "Fragrância conforme" },
  { key: "rotulagem_conforme", label: "Rotulagem conforme" },
  { key: "peso_conforme", label: "Peso conforme" },
];

const RNC_TIPOS = [
  { value: "cor", label: "Cor não conforme" },
  { value: "textura", label: "Textura não conforme" },
  { value: "fragrancia", label: "Fragrância não conforme" },
  { value: "rotulagem", label: "Rotulagem incorreta" },
  { value: "peso", label: "Peso fora da especificação" },
  { value: "embalagem", label: "Embalagem danificada" },
  { value: "outro", label: "Outro" },
];

export function TabAprovacaoFisica({ produtoBrasilId }: { produtoBrasilId: string }) {
  const { data: aprovacao } = useAprovacaoFisica(produtoBrasilId);
  const { data: rncs = [] } = useProdutoRNCs(produtoBrasilId);
  const createAprovacao = useCreateAprovacaoFisica();
  const createRNC = useCreateRNC();

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [obs, setObs] = useState("");
  const [showRNCDialog, setShowRNCDialog] = useState(false);
  const [rncDesc, setRncDesc] = useState("");
  const [rncTipo, setRncTipo] = useState("outro");
  const [rncAcao, setRncAcao] = useState("");
  const [rncFornecedor, setRncFornecedor] = useState("");

  const allChecked = CONFORMIDADE_ITEMS.every((i) => checklist[i.key]);
  const anyFailed = CONFORMIDADE_ITEMS.some((i) => checklist[i.key] === false && i.key in checklist);

  const handleAprovar = async () => {
    const resultado = allChecked ? "aprovado" : "nao_conforme";
    await createAprovacao.mutateAsync({
      produto_brasil_id: produtoBrasilId,
      ...Object.fromEntries(CONFORMIDADE_ITEMS.map((i) => [i.key, checklist[i.key] || false])),
      resultado,
      observacoes: obs || undefined,
    });
  };

  const handleCreateRNC = async () => {
    await createRNC.mutateAsync({
      produto_brasil_id: produtoBrasilId,
      aprovacao_fisica_id: aprovacao?.id,
      descricao: rncDesc,
      tipo_nao_conformidade: rncTipo,
      acao_corretiva: rncAcao || undefined,
      fornecedor_nome: rncFornecedor || undefined,
    });
    setShowRNCDialog(false);
    setRncDesc("");
    setRncAcao("");
    setRncFornecedor("");
  };

  return (
    <div className="space-y-4">
      {/* Current approval or create new */}
      {aprovacao ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Resultado da Aprovação Física</CardTitle>
              <Badge variant={aprovacao.resultado === "aprovado" ? "default" : "destructive"} className={aprovacao.resultado === "aprovado" ? "bg-success/15 text-success" : ""}>
                {aprovacao.resultado === "aprovado" ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Aprovado</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Não Conforme</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {CONFORMIDADE_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                {(aprovacao as any)[item.key] ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                )}
                <span>{item.label}</span>
              </div>
            ))}
            {aprovacao.observacoes && <p className="text-muted-foreground mt-2">{aprovacao.observacoes}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist de Aprovação Física</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CONFORMIDADE_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <Checkbox
                  checked={checklist[item.key] || false}
                  onCheckedChange={(v) => setChecklist((prev) => ({ ...prev, [item.key]: !!v }))}
                />
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Observações (opcional)"
              rows={2}
              className="mt-2"
            />
            <Button onClick={handleAprovar} disabled={createAprovacao.isPending} className="w-full">
              {allChecked ? "Aprovar Produto" : "Registrar Não Conformidade"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* RNC Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Registros de Não Conformidade (RNC)
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowRNCDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova RNC
          </Button>
        </div>

        {rncs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma RNC registrada.</p>
        ) : (
          <div className="space-y-2">
            {rncs.map((rnc) => (
              <Card key={rnc.id}>
                <CardContent className="py-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{RNC_TIPOS.find((t) => t.value === rnc.tipo_nao_conformidade)?.label || rnc.tipo_nao_conformidade}</span>
                    <Badge variant="outline" className={rnc.status === "aberta" ? "text-destructive" : "text-success"}>
                      {rnc.status === "aberta" ? "Aberta" : "Resolvida"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{rnc.descricao}</p>
                  {rnc.acao_corretiva && <p><span className="font-medium">Ação:</span> {rnc.acao_corretiva}</p>}
                  {rnc.fornecedor_nome && <p><span className="font-medium">Fornecedor:</span> {rnc.fornecedor_nome}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showRNCDialog} onOpenChange={setShowRNCDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Não Conformidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={rncTipo} onValueChange={setRncTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RNC_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={rncDesc} onChange={(e) => setRncDesc(e.target.value)} rows={2} placeholder="Descreva a não conformidade..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ação Corretiva</Label>
              <Input value={rncAcao} onChange={(e) => setRncAcao(e.target.value)} placeholder="Ação a ser tomada..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Input value={rncFornecedor} onChange={(e) => setRncFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRNCDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateRNC} disabled={!rncDesc.trim() || createRNC.isPending}>
              {createRNC.isPending ? "Registrando..." : "Registrar RNC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
