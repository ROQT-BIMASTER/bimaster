import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
  precos: any[];
}

export function ExportarTabelaPDF({ open, onOpenChange, tabela, precos }: Props) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    titulo: tabela?.nome || "Tabela de Preços",
    subtitulo: "",
    observacoes: "",
    layout: "completo" as "completo" | "condensado",
    mostrarCusto: false,
    mostrarMargem: false,
    mostrarCodigo: true,
    mostrarCategoria: true,
    dataValidade: "",
  });

  const handleExportar = async () => {
    if (!precos || precos.length === 0) {
      toast.error("Nenhum preço para exportar");
      return;
    }

    setLoading(true);

    try {
      // Criar conteúdo HTML para o PDF
      const htmlContent = gerarHTML();
      
      // Abrir nova janela para impressão/PDF
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Bloqueador de pop-up ativo. Permita pop-ups para exportar.");
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Aguardar carregamento e abrir diálogo de impressão
      printWindow.onload = () => {
        printWindow.print();
      };

      toast.success("PDF gerado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  };

  const gerarHTML = () => {
    const dataAtual = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const dataValidade = config.dataValidade 
      ? format(new Date(config.dataValidade), "dd/MM/yyyy", { locale: ptBR })
      : null;

    const colunas = [
      config.mostrarCodigo && { header: "Código", key: "codigo" },
      { header: "Produto", key: "nome" },
      config.mostrarCategoria && { header: "Categoria", key: "categoria" },
      config.mostrarCusto && { header: "Custo", key: "custo" },
      { header: "Preço", key: "preco" },
      config.mostrarMargem && { header: "Margem", key: "margem" },
    ].filter(Boolean);

    const linhas = precos.map(p => {
      // Calcular margem baseada na tabela base se disponível
      const precoFinal = p.preco_final || 0;
      const precoBase = p.preco_tabela_base || 0;
      const custoBase = p.custo_base || 0;
      const referencia = precoBase > 0 ? precoBase : custoBase;
      const margemCalculada = precoFinal > 0 && referencia > 0
        ? ((precoFinal - referencia) / precoFinal) * 100
        : (p.margem_lucro_percentual || 0);

      return {
        codigo: p.produto?.codigo || "-",
        nome: p.produto?.nome || "-",
        categoria: p.produto?.categoria || "-",
        custo: formatarMoeda(referencia),
        preco: formatarMoeda(precoFinal),
        margem: `${margemCalculada.toFixed(1)}%`,
      };
    });

    const isCondensado = config.layout === "condensado";

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${config.titulo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: ${isCondensado ? '10px' : '12px'};
      color: #333;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      font-size: ${isCondensado ? '18px' : '24px'};
      font-weight: bold;
      margin-bottom: 5px;
    }
    .header .subtitulo {
      font-size: ${isCondensado ? '12px' : '14px'};
      color: #666;
    }
    .header .info {
      margin-top: 10px;
      font-size: 11px;
      color: #888;
    }
    .info-box {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .info-box span {
      font-size: 11px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: ${isCondensado ? '4px 6px' : '8px 12px'};
      text-align: left;
    }
    th {
      background: #333;
      color: white;
      font-weight: 600;
      font-size: ${isCondensado ? '9px' : '11px'};
      text-transform: uppercase;
    }
    td {
      font-size: ${isCondensado ? '9px' : '11px'};
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .preco {
      font-weight: bold;
      text-align: right;
    }
    .custo, .margem {
      text-align: right;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #666;
    }
    .footer .observacoes {
      margin-bottom: 15px;
      padding: 10px;
      background: #fffbe6;
      border: 1px solid #ffe58f;
      border-radius: 4px;
    }
    .stats {
      display: flex;
      gap: 30px;
      margin-bottom: 20px;
    }
    .stat-item {
      text-align: center;
    }
    .stat-item .value {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
    .stat-item .label {
      font-size: 10px;
      color: #666;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.titulo}</h1>
    ${config.subtitulo ? `<p class="subtitulo">${config.subtitulo}</p>` : ''}
    <p class="info">
      Código: ${tabela?.codigo || '-'} | 
      Gerado em: ${dataAtual}
      ${dataValidade ? ` | Válido até: ${dataValidade}` : ''}
    </p>
  </div>

  <div class="stats">
    <div class="stat-item">
      <div class="value">${precos.length}</div>
      <div class="label">Produtos</div>
    </div>
    <div class="stat-item">
      <div class="value">${formatarMoeda(precos.reduce((acc, p) => acc + (p.preco_final || 0), 0) / precos.length)}</div>
      <div class="label">Preço Médio</div>
    </div>
    ${config.mostrarMargem ? `
    <div class="stat-item">
      <div class="value">${(precos.reduce((acc, p) => acc + (p.margem_lucro_percentual || 0), 0) / precos.length).toFixed(1)}%</div>
      <div class="label">Margem Média</div>
    </div>
    ` : ''}
  </div>

  <table>
    <thead>
      <tr>
        ${colunas.map(c => `<th>${(c as any).header}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${linhas.map(linha => `
        <tr>
          ${colunas.map(c => {
            const key = (c as any).key;
            const value = (linha as any)[key];
            const className = key === 'preco' ? 'preco' : key === 'custo' ? 'custo' : key === 'margem' ? 'margem' : '';
            return `<td class="${className}">${value}</td>`;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    ${config.observacoes ? `
    <div class="observacoes">
      <strong>Observações:</strong><br/>
      ${config.observacoes.replace(/\n/g, '<br/>')}
    </div>
    ` : ''}
    <p>Este documento foi gerado automaticamente pelo sistema de gestão de preços.</p>
    <p>Os preços podem sofrer alterações sem aviso prévio.</p>
  </div>
</body>
</html>
    `;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar Tabela de Preços</DialogTitle>
          <DialogDescription>
            Configure as opções de exportação para PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título do Documento</Label>
            <Input
              id="titulo"
              value={config.titulo}
              onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
              placeholder="Ex: Tabela de Preços - Atacado"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitulo">Subtítulo (opcional)</Label>
            <Input
              id="subtitulo"
              value={config.subtitulo}
              onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
              placeholder="Ex: Vigência: Janeiro 2025"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="validade">Data de Validade (opcional)</Label>
            <Input
              id="validade"
              type="date"
              value={config.dataValidade}
              onChange={(e) => setConfig({ ...config, dataValidade: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Layout</Label>
            <RadioGroup
              value={config.layout}
              onValueChange={(v) => setConfig({ ...config, layout: v as any })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="completo" id="completo" />
                <Label htmlFor="completo" className="font-normal">Completo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="condensado" id="condensado" />
                <Label htmlFor="condensado" className="font-normal">Condensado</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Colunas a Exibir</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarCodigo" className="font-normal">Código</Label>
                <Switch
                  id="mostrarCodigo"
                  checked={config.mostrarCodigo}
                  onCheckedChange={(v) => setConfig({ ...config, mostrarCodigo: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarCategoria" className="font-normal">Categoria</Label>
                <Switch
                  id="mostrarCategoria"
                  checked={config.mostrarCategoria}
                  onCheckedChange={(v) => setConfig({ ...config, mostrarCategoria: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarCusto" className="font-normal">Custo Base</Label>
                <Switch
                  id="mostrarCusto"
                  checked={config.mostrarCusto}
                  onCheckedChange={(v) => setConfig({ ...config, mostrarCusto: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarMargem" className="font-normal">Margem</Label>
                <Switch
                  id="mostrarMargem"
                  checked={config.mostrarMargem}
                  onCheckedChange={(v) => setConfig({ ...config, mostrarMargem: v })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              value={config.observacoes}
              onChange={(e) => setConfig({ ...config, observacoes: e.target.value })}
              placeholder="Informações adicionais que aparecerão no rodapé..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
