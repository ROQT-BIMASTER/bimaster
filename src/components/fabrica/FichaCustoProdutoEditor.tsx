import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, FileText } from "lucide-react";
import { CustoInsumo, CustoConfig, Totais } from "@/hooks/useFichaCustoProduto";
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
        <CardHeader className="pb-3">
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
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
            <div>
              <Label htmlFor="mo_nf">M.O. NF (R$)</Label>
              <Input
                id="mo_nf"
                type="number"
                step="0.000001"
                value={config?.custo_mao_obra_nf || ""}
                onChange={(e) =>
                  onAtualizarConfig("custo_mao_obra_nf", parseFloat(e.target.value) || 0)
                }
                placeholder="0,000"
              />
            </div>
            <div>
              <Label htmlFor="mo_servico">M.O. Serviço (R$)</Label>
              <Input
                id="mo_servico"
                type="number"
                step="0.000001"
                value={config?.custo_mao_obra_servico || ""}
                onChange={(e) =>
                  onAtualizarConfig("custo_mao_obra_servico", parseFloat(e.target.value) || 0)
                }
                placeholder="0,000"
              />
            </div>
            <div>
              <Label htmlFor="markup">Markup (%)</Label>
              <Input
                id="markup"
                type="number"
                step="0.01"
                value={config?.percentual_markup || ""}
                onChange={(e) =>
                  onAtualizarConfig("percentual_markup", parseFloat(e.target.value) || 0)
                }
                placeholder="10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Insumos */}
      <Card>
        <CardHeader className="pb-3">
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
        <CardContent>
          {insumos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum insumo adicionado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="w-32">Fornecedor</TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead className="w-24 text-right">NF</TableHead>
                    <TableHead className="w-24 text-right">Serviço</TableHead>
                    <TableHead className="w-24 text-right">Condição</TableHead>
                    <TableHead className="w-28">NF Ref.</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumos.map((insumo) => (
                    <TableRow key={insumo.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {insumo.codigo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {insumo.nome}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={insumo.fornecedor || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(insumo.id, "fornecedor", e.target.value)
                          }
                          className="h-8 text-sm"
                          placeholder="Fornecedor"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={insumo.tipo_insumo}
                          onValueChange={(value) =>
                            onAtualizarInsumo(insumo.id, "tipo_insumo", value)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
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
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.000001"
                          value={insumo.custo_nf || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(
                              insumo.id,
                              "custo_nf",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-8 text-sm text-right"
                          placeholder="0,000"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.000001"
                          value={insumo.custo_servico || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(
                              insumo.id,
                              "custo_servico",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-8 text-sm text-right"
                          placeholder="0,000"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.000001"
                          value={insumo.custo_condicao || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(
                              insumo.id,
                              "custo_condicao",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-8 text-sm text-right"
                          placeholder="0,000"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={insumo.nf_referencia || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(insumo.id, "nf_referencia", e.target.value)
                          }
                          className="h-8 text-sm"
                          placeholder="NF12345"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onRemoverInsumo(insumo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linha de Markup */}
      {config && Number(config.percentual_markup) > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Markup {config.percentual_markup}%
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Totais</CardTitle>
        </CardHeader>
        <CardContent>
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
