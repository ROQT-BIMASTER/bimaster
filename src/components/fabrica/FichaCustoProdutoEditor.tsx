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
import { Plus, Trash2, GripVertical, Save, FileText, Info, Printer, Download } from "lucide-react";
import { CustoInsumo, CustoConfig, Totais, BaseCalculoMarkup } from "@/hooks/useFichaCustoProduto";
import { AdicionarInsumoCustoDialog } from "./AdicionarInsumoCustoDialog";
import { ImportarInsumosIA } from "./ImportarInsumosIA";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { FichaAprovacaoBanner } from "./FichaAprovacaoBanner";
import { FichaApontamentosPanel } from "./FichaApontamentosPanel";
import type { StatusAprovacao, RevisaoItem, Revisao } from "@/hooks/useFichaRevisao";
import { SendHorizonal } from "lucide-react";

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
  statusAprovacao?: StatusAprovacao;
  revisaoAtiva?: Revisao | null;
  apontamentos?: RevisaoItem[];
  submitting?: boolean;
  onSubmeterAprovacao?: () => void;
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
  statusAprovacao = "rascunho",
  revisaoAtiva,
  apontamentos = [],
  submitting = false,
  onSubmeterAprovacao,
}: Props) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const isLocked = statusAprovacao === "em_revisao" || statusAprovacao === "aprovada";

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

  const getTipoLabel = (value: string) => {
    const found = tiposInsumo.find(t => t.value === value);
    return found?.label || value;
  };

  const handlePrintPDF = () => {
    const baseMarkupLabel = config?.base_calculo_markup === 'nf' ? 'sobre NF' 
      : config?.base_calculo_markup === 'servico' ? 'sobre Serviço' 
      : config?.base_calculo_markup === 'nf_servico' ? 'sobre NF+Serviço' 
      : 'sobre Totais';

    const html = `
      <html>
      <head>
        <title>Ficha de Custos - ${produto?.nome || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .subtitle { color: #666; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .text-right { text-align: right; }
          .config { display: flex; gap: 24px; margin: 12px 0; flex-wrap: wrap; }
          .config-item label { font-weight: 600; display: block; font-size: 11px; color: #666; }
          .totais { display: flex; gap: 16px; margin: 16px 0; }
          .total-box { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 12px; text-align: center; }
          .total-box.destaque { border: 2px solid #3b82f6; background: #eff6ff; }
          .total-box .label { font-size: 11px; color: #666; }
          .total-box .valor { font-size: 18px; font-weight: 700; }
          .markup-info { background: #f9fafb; padding: 8px 12px; border-radius: 4px; margin: 8px 0; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Ficha de Custos - ${produto?.nome || ''}</h1>
        <div class="subtitle">Código: ${produto?.codigo || ''} | Origem: ${produto?.origem === 'importado' ? 'Importado' : 'Nacional'}</div>
        <div class="config">
          <div class="config-item"><label>Fornecedor M.O.</label>${config?.fornecedor_mao_obra || '-'}</div>
          <div class="config-item"><label>M.O. NF</label>R$ ${formatarValor(Number(config?.custo_mao_obra_nf) || 0)}</div>
          <div class="config-item"><label>M.O. Serviço</label>R$ ${formatarValor(Number(config?.custo_mao_obra_servico) || 0)}</div>
          <div class="config-item"><label>Markup</label>${config?.percentual_markup || 0}% (${baseMarkupLabel})</div>
        </div>
        <table>
          <thead><tr>
            <th>Código</th><th>Insumo</th><th>Tipo</th><th>Fornecedor</th>
            <th class="text-right">NF (R$)</th><th class="text-right">Serviço (R$)</th><th class="text-right">Condição (R$)</th><th>NF Ref.</th>
          </tr></thead>
          <tbody>
            ${insumos.map(i => `<tr>
              <td>${i.codigo}</td><td>${i.nome}</td><td>${getTipoLabel(i.tipo_insumo)}</td><td>${i.fornecedor || '-'}</td>
              <td class="text-right">${formatarValor(Number(i.custo_nf) || 0)}</td>
              <td class="text-right">${formatarValor(Number(i.custo_servico) || 0)}</td>
              <td class="text-right">${formatarValor(Number(i.custo_condicao) || 0)}</td>
              <td>${i.nf_referencia || '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${Number(config?.percentual_markup) > 0 ? `<div class="markup-info">Markup ${config?.percentual_markup}% (${baseMarkupLabel}) — NF: ${formatarMoeda(totais.markupNF)} | Serviço: ${formatarMoeda(totais.markupServico)} | Condição: ${formatarMoeda(totais.markupCondicao)}</div>` : ''}
        <div class="totais">
          <div class="total-box"><div class="label">NF</div><div class="valor">${formatarMoeda(totais.totalNF + totais.markupNF)}</div></div>
          <div class="total-box"><div class="label">Serviço</div><div class="valor">${formatarMoeda(totais.totalServico + totais.markupServico)}</div></div>
          <div class="total-box"><div class="label">Condição</div><div class="valor">${formatarMoeda(totais.totalCondicao + totais.markupCondicao)}</div></div>
          <div class="total-box destaque"><div class="label">Custo Total</div><div class="valor">${formatarMoeda(totais.custoTotal)}</div></div>
        </div>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const ws = workbook.addWorksheet('Ficha de Custos');

    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Ficha de Custos - ${produto?.nome || ''}`;
    titleCell.font = { bold: true, size: 14 };
    
    ws.mergeCells('A2:H2');
    ws.getCell('A2').value = `Código: ${produto?.codigo || ''} | Origem: ${produto?.origem === 'importado' ? 'Importado' : 'Nacional'}`;
    ws.getCell('A2').font = { color: { argb: 'FF666666' } };

    ws.getCell('A4').value = 'Fornecedor M.O.';
    ws.getCell('B4').value = config?.fornecedor_mao_obra || '-';
    ws.getCell('C4').value = 'M.O. NF';
    ws.getCell('D4').value = Number(config?.custo_mao_obra_nf) || 0;
    ws.getCell('E4').value = 'M.O. Serviço';
    ws.getCell('F4').value = Number(config?.custo_mao_obra_servico) || 0;
    ws.getCell('G4').value = 'Markup';
    ws.getCell('H4').value = `${config?.percentual_markup || 0}%`;
    ['A4','C4','E4','G4'].forEach(c => { ws.getCell(c).font = { bold: true }; });

    const headers = ['Código', 'Insumo', 'Tipo', 'Fornecedor', 'NF (R$)', 'Serviço (R$)', 'Condição (R$)', 'NF Ref.'];
    ws.addRow([]);
    ws.addRow(headers);
    const hRow = ws.getRow(ws.rowCount);
    hRow.font = { bold: true };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    insumos.forEach(i => {
      ws.addRow([
        i.codigo, i.nome, getTipoLabel(i.tipo_insumo), i.fornecedor || '',
        Number(i.custo_nf) || 0, Number(i.custo_servico) || 0, Number(i.custo_condicao) || 0,
        i.nf_referencia || '',
      ]);
    });

    ws.addRow([]);
    const totRow = ws.addRow(['', '', '', 'TOTAIS', totais.totalNF + totais.markupNF, totais.totalServico + totais.markupServico, totais.totalCondicao + totais.markupCondicao, '']);
    totRow.font = { bold: true };
    ws.addRow(['', '', '', 'CUSTO TOTAL', totais.custoTotal]);
    ws.getRow(ws.rowCount).font = { bold: true, size: 12 };

    ws.columns = [
      { width: 12 }, { width: 30 }, { width: 18 }, { width: 18 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `ficha-custos-${produto?.codigo || 'produto'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Banner de status de aprovação */}
      {config?.id && (
        <FichaAprovacaoBanner
          status={statusAprovacao}
          parecer={revisaoAtiva?.parecer}
        />
      )}

      {/* Apontamentos da diretoria */}
      {statusAprovacao === "revisao_solicitada" && apontamentos.length > 0 && (
        <FichaApontamentosPanel apontamentos={apontamentos} insumos={insumos} />
      )}

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
                disabled={isLocked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo_nf">M.O. NF (R$)</Label>
              <DecimalInput
                id="mo_nf"
                value={config?.custo_mao_obra_nf ?? 0}
                onChange={(val) => onAtualizarConfig("custo_mao_obra_nf", val)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo_servico">M.O. Serviço (R$)</Label>
              <DecimalInput
                id="mo_servico"
                value={config?.custo_mao_obra_servico ?? 0}
                onChange={(val) => onAtualizarConfig("custo_mao_obra_servico", val)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="markup">Markup (%)</Label>
              <DecimalInput
                id="markup"
                value={config?.percentual_markup ?? 0}
                onChange={(val) => onAtualizarConfig("percentual_markup", val)}
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
                disabled={isLocked}
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

      {/* Tabela de Insumos */}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="min-w-[80px]">Código</TableHead>
                    <TableHead className="min-w-[180px]">Insumo</TableHead>
                    <TableHead className="min-w-[140px]">Tipo</TableHead>
                    <TableHead className="min-w-[140px]">Fornecedor</TableHead>
                    <TableHead className="min-w-[110px] text-right">NF (R$)</TableHead>
                    <TableHead className="min-w-[110px] text-right">Serviço (R$)</TableHead>
                    <TableHead className="min-w-[110px] text-right">Condição (R$)</TableHead>
                    <TableHead className="min-w-[120px]">NF Ref.</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumos.map((insumo) => (
                    <TableRow key={insumo.id}>
                      <TableCell className="px-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {insumo.codigo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {insumo.nome}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <Input
                          value={insumo.fornecedor || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(insumo.id, "fornecedor", e.target.value)
                          }
                          className="h-9"
                          placeholder="Fornecedor"
                        />
                      </TableCell>
                      <TableCell>
                        <DecimalInput
                          value={insumo.custo_nf}
                          onChange={(val) => onAtualizarInsumo(insumo.id, "custo_nf", val)}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <DecimalInput
                          value={insumo.custo_servico}
                          onChange={(val) => onAtualizarInsumo(insumo.id, "custo_servico", val)}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <DecimalInput
                          value={insumo.custo_condicao}
                          onChange={(val) => onAtualizarInsumo(insumo.id, "custo_condicao", val)}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={insumo.nf_referencia || ""}
                          onChange={(e) =>
                            onAtualizarInsumo(insumo.id, "nf_referencia", e.target.value)
                          }
                          className="h-9"
                          placeholder="NF12345"
                        />
                      </TableCell>
                      <TableCell className="px-2">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintPDF}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
        <div className="flex gap-2">
          {!isLocked && (
            <Button onClick={onSalvar} disabled={saving} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Ficha"}
            </Button>
          )}
          {(statusAprovacao === "rascunho" || statusAprovacao === "revisao_solicitada") && onSubmeterAprovacao && config?.id && (
            <Button onClick={onSubmeterAprovacao} disabled={submitting}>
              <SendHorizonal className="h-4 w-4 mr-2" />
              {submitting ? "Submetendo..." : "Submeter para Aprovação"}
            </Button>
          )}
        </div>
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
