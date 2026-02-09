import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, FileText, Info } from "lucide-react";
import { CustoInsumo, CustoConfig, Totais, BaseCalculoMarkup } from "@/hooks/useFichaCustoProduto";
import { AdicionarInsumoCustoDialog } from "./AdicionarInsumoCustoDialog";
import { ImportarInsumosIA } from "./ImportarInsumosIA";

interface Props {
  produto: any;
  insumos: CustoInsumo[];
  config: CustoConfig | null;
  totais: Totais;
  saving: boolean;
  tiposInsumo: { value: string; label: string }[];
  onAdicionarInsumo: (insumo: Partial<CustoInsumo>) => void;
  onAtualizarInsumo: (id: string, campo: keyof CustoInsumo, valor: any) => void;
  onRemoverInsumo: (id: string) => void;
  onAtualizarConfig: (campo: keyof CustoConfig, valor: any) => void;
  onSalvar: () => void;
}

function DecimalInput({
  value,
  onChange,
  placeholder = "0.000",
  className = "",
  id,
}: {
  value: number | string;
  onChange: (val: number | string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const displayValue = value === 0 ? "0" : (value || "");
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
          onChange(raw === "" ? 0 : raw.endsWith(".") ? raw : parseFloat(raw) || 0);
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

export function FichaCustoProdutoEditor({
  produto,
  insumos,
  config,
  totais,
  saving,
  tiposInsumo,
  onAdicionarInsumo,
  onAtualizarInsumo,
  onRemoverInsumo,
  onAtualizarConfig,
  onSalvar,
}: Props) {
  const [dialogAberto, setDialogAberto] = useState(false);

  const formatarValor = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    });
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header do produto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                Ficha de Custos - {produto?.nome}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                <span>Código: <span className="font-mono">{produto?.codigo}</span></span>
                <span>|</span>
                <span className="flex items-center gap-1">
                  Origem:{" "}
                  <Badge variant={produto?.origem === "importado" ? "destructive" : "secondary"}>
                    {produto?.origem === "importado" ? "Importado" : "Nacional"}
                  </Badge>
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuração M.O. e Markup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor_mo">Fornecedor M.O.</Label>
              <Input
                id="fornecedor_mo"
                value={config?.fornecedor_mao_obra || ""}
                onChange={(e) =>
                  onAtualizarConfig("fornecedor_mao_obra", e.target.value)
                }
                placeholder="Ex: Rodrigues"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo_nf">M.O. NF (R$)</Label>
              <DecimalInput
                id="mo_nf"
                value={config?.custo_mao_obra_nf ?? 0}
                onChange={(val) => onAtualizarConfig("custo_mao_obra_nf", typeof val === "string" ? val : val)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo_servico">M.O. Serviço (R$)</Label>
              <DecimalInput
                id="mo_servico"
                value={config?.custo_mao_obra_servico ?? 0}
                onChange={(val) => onAtualizarConfig("custo_mao_obra_servico", typeof val === "string" ? val : val)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="markup">Markup (%)</Label>
              <DecimalInput
                id="markup"
                value={config?.percentual_markup ?? 0}
                onChange={(val) => onAtualizarConfig("percentual_markup", typeof val === "string" ? val : val)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="base_markup">Base do Markup</Label>
              <Select
                value={config?.base_calculo_markup || "total"}
                onValueChange={(value) =>
                  onAtualizarConfig("base_calculo_markup", value as BaseCalculoMarkup)
                }
              >
                <SelectTrigger id="base_markup">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Totais (NF+Serv+Cond)</SelectItem>
                  <SelectItem value="nf_servico">NF + Serviço</SelectItem>
                  <SelectItem value="nf">Somente NF</SelectItem>
                  <SelectItem value="servico">Somente Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insumos como Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Insumos</CardTitle>
            <div className="flex gap-2">
              <ImportarInsumosIA
                onImportar={(insumos) => {
                  insumos.forEach((insumo) => onAdicionarInsumo(insumo));
                }}
              />
              <Button size="sm" onClick={() => setDialogAberto(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {insumos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum insumo adicionado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div className="space-y-3">
              {insumos.map((insumo) => (
                <div
                  key={insumo.id}
                  className="border border-border rounded-lg p-4 bg-background hover:shadow-sm transition-shadow"
                >
                  {/* Header do card: grip + código/nome + delete */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                      <span className="font-mono text-sm text-muted-foreground flex-shrink-0">
                        {insumo.codigo}
                      </span>
                      <span className="font-medium truncate">
                        {insumo.nome}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => onRemoverInsumo(insumo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Tipo + Fornecedor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <Select
                        value={insumo.tipo_insumo}
                        onValueChange={(value) =>
                          onAtualizarInsumo(insumo.id, "tipo_insumo", value)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposInsumo.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                      <Input
                        value={insumo.fornecedor || ""}
                        onChange={(e) =>
                          onAtualizarInsumo(insumo.id, "fornecedor", e.target.value)
                        }
                        className="h-9"
                        placeholder="Fornecedor"
                      />
                    </div>
                  </div>

                  {/* Custos + NF Ref */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">NF (R$)</Label>
                      <DecimalInput
                        value={insumo.custo_nf}
                        onChange={(val) => onAtualizarInsumo(insumo.id, "custo_nf", val)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Serviço (R$)</Label>
                      <DecimalInput
                        value={insumo.custo_servico}
                        onChange={(val) => onAtualizarInsumo(insumo.id, "custo_servico", val)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Condição (R$)</Label>
                      <DecimalInput
                        value={insumo.custo_condicao}
                        onChange={(val) => onAtualizarInsumo(insumo.id, "custo_condicao", val)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">NF Ref.</Label>
                      <Input
                        value={insumo.nf_referencia || ""}
                        onChange={(e) =>
                          onAtualizarInsumo(insumo.id, "nf_referencia", e.target.value)
                        }
                        className="h-10"
                        placeholder="NF12345"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linha de Markup */}
      {config && Number(config.percentual_markup) > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <span className="font-medium">
                Markup {config.percentual_markup}%
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  ({config.base_calculo_markup === 'nf' ? 'sobre NF' : config.base_calculo_markup === 'servico' ? 'sobre Serviço' : config.base_calculo_markup === 'nf_servico' ? 'sobre NF+Serviço' : 'sobre Totais'})
                </span>
              </span>
              <div className="flex gap-6">
                <span>
                  NF: <strong>{formatarMoeda(totais.markupNF)}</strong>
                </span>
                <span>
                  Serv: <strong>{formatarMoeda(totais.markupServico)}</strong>
                </span>
                <span>
                  Cond: <strong>{formatarMoeda(totais.markupCondicao)}</strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totais</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">NF</p>
              <p className="text-xl font-bold">{formatarMoeda(totais.totalNF + totais.markupNF)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Serviço</p>
              <p className="text-xl font-bold">{formatarMoeda(totais.totalServico + totais.markupServico)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Condição</p>
              <p className="text-xl font-bold">{formatarMoeda(totais.totalCondicao + totais.markupCondicao)}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg text-center border-2 border-primary">
              <p className="text-sm text-muted-foreground">Custo Total</p>
              <p className="text-2xl font-bold text-primary">
                {formatarMoeda(totais.custoTotal)}
              </p>
            </div>
          </div>

          {/* Regra aplicada */}
          {config && Number(config.percentual_markup) > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                {config.base_calculo_markup === 'total' && `Markup de ${config.percentual_markup}% aplicado sobre NF + Serviço + Condição`}
                {config.base_calculo_markup === 'nf_servico' && `Markup de ${config.percentual_markup}% aplicado sobre NF + Serviço`}
                {config.base_calculo_markup === 'nf' && `Markup de ${config.percentual_markup}% aplicado somente sobre NF`}
                {config.base_calculo_markup === 'servico' && `Markup de ${config.percentual_markup}% aplicado somente sobre Serviço`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button variant="outline" disabled>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
        <Button onClick={onSalvar} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Ficha"}
        </Button>
      </div>

      {/* Dialog de adicionar */}
      <AdicionarInsumoCustoDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onAdicionar={onAdicionarInsumo}
      />
    </div>
  );
}
