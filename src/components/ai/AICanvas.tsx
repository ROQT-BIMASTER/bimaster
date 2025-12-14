import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  Copy, 
  Printer, 
  Edit3, 
  Save, 
  X, 
  Sparkles,
  BarChart3,
  Table,
  FileSpreadsheet,
  RefreshCw,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import ReactMarkdown from "react-markdown";

interface AICanvasProps {
  content: string;
  title?: string;
  onClose: () => void;
  onRegenerate?: (instructions: string) => void;
  isLoading?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export const AICanvas = ({ content, title = "Relatório IA", onClose, onRegenerate, isLoading }: AICanvasProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [editInstructions, setEditInstructions] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      // Remove chart blocks for plain text copy
      const plainText = editedContent.replace(/```chart[\s\S]*?```/g, '[Gráfico]');
      await navigator.clipboard.writeText(plainText);
      toast({ title: "Copiado!", description: "Conteúdo copiado para a área de transferência" });
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
            h2, h3 { color: #374151; margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: 600; }
            .chart-placeholder { background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 16px 0; }
            ul, ol { padding-left: 24px; }
            li { margin-bottom: 8px; }
            strong { color: #1f2937; }
            .timestamp { color: #6b7280; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${editedContent.replace(/```chart[\s\S]*?```/g, '<div class="chart-placeholder">📊 Gráfico disponível na versão digital</div>')}
          <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    const blob = new Blob([editedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado", description: "Relatório exportado como Markdown" });
  };

  const handleExportCSV = () => {
    // Extract tables from markdown and convert to CSV
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:\s|]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
    let csvContent = "";
    let match;
    let tableCount = 0;

    while ((match = tableRegex.exec(editedContent)) !== null) {
      tableCount++;
      const headers = match[1].split('|').map(h => h.trim()).filter(Boolean);
      const rows = match[2].trim().split('\n').map(row => 
        row.split('|').map(cell => cell.trim()).filter(Boolean)
      );
      
      csvContent += headers.join(',') + '\n';
      rows.forEach(row => {
        csvContent += row.join(',') + '\n';
      });
      csvContent += '\n';
    }

    if (csvContent) {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_dados.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "CSV exportado", description: `${tableCount} tabela(s) exportada(s)` });
    } else {
      toast({ title: "Sem tabelas", description: "Nenhuma tabela encontrada para exportar", variant: "destructive" });
    }
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    toast({ title: "Salvo", description: "Alterações salvas com sucesso" });
  };

  const handleRegenerate = () => {
    if (onRegenerate && editInstructions.trim()) {
      onRegenerate(editInstructions);
      setEditInstructions("");
    }
  };

  const renderChart = (chartConfig: any) => {
    const { type, title: chartTitle, data } = chartConfig;

    const chartComponent = () => {
      switch (type) {
        case "bar":
          return (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Legend />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          );
        case "line":
          return (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
            </LineChart>
          );
        case "pie":
          return (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={40}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          );
        case "area":
          return (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Legend />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#colorValue)" />
            </AreaChart>
          );
        default:
          return null;
      }
    };

    return (
      <Card className="p-6 my-6 bg-card/50 backdrop-blur">
        <h4 className="text-base font-semibold mb-4 flex items-center gap-2 text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" />
          {chartTitle}
        </h4>
        <ResponsiveContainer width="100%" height={320}>
          {chartComponent()}
        </ResponsiveContainer>
      </Card>
    );
  };

  const renderContent = () => {
    const parts = editedContent.split(/(```chart[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```chart")) {
        try {
          const jsonStr = part.replace(/```chart\n?/g, "").replace(/```/g, "").trim();
          const chartConfig = JSON.parse(jsonStr);
          return <div key={index}>{renderChart(chartConfig)}</div>;
        } catch (e) {
          console.error("Error parsing chart:", e);
          return null;
        }
      }
      return (
        <div key={index} className="prose prose-slate dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-table:text-sm">
          <ReactMarkdown>
            {part}
          </ReactMarkdown>
        </div>
      );
    });
  };

  return (
    <div className={`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 ${isFullscreen ? 'p-0' : ''}`}>
      <Card 
        ref={canvasRef}
        className={`flex flex-col bg-card shadow-2xl ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[90vh] rounded-xl'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{title}</h2>
              <p className="text-xs text-muted-foreground">Gerado por IA • {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" />
              Canvas
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b bg-muted/10 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Separator orientation="vertical" className="h-6 mx-2" />
          {isEditing ? (
            <>
              <Button variant="default" size="sm" onClick={handleSaveEdit} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditedContent(content); }}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
              <Edit3 className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-6">
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
              placeholder="Edite o conteúdo do relatório..."
            />
          ) : (
            <div className="max-w-4xl mx-auto">
              {renderContent()}
            </div>
          )}
        </ScrollArea>

        {/* AI Refinement Panel */}
        {onRegenerate && (
          <div className="p-4 border-t bg-muted/10">
            <div className="flex gap-2">
              <Textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder="Instruções para refinar o relatório... Ex: 'Adicione mais detalhes sobre vendas' ou 'Inclua um gráfico de pizza'"
                className="min-h-[50px] resize-none"
                disabled={isLoading}
              />
              <Button 
                onClick={handleRegenerate} 
                disabled={!editInstructions.trim() || isLoading}
                className="gap-2 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refinar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Peça à IA para modificar, expandir ou reformatar o relatório
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
