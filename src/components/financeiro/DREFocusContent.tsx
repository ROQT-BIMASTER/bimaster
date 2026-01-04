import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Building2 } from "lucide-react";

interface DRENode {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'grupo' | 'subtotal' | 'conta' | 'departamento' | 'fornecedor' | 'lancamento';
  nivel: number;
  valor: number;
  valoresMensais?: { [mes: string]: number };
  natureza: 'D' | 'C';
  accountType: string;
  children?: DRENode[];
  metadata?: any;
  sinal?: '+' | '-' | '=';
}

interface MonthData {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface DREFocusContentProps {
  visaoAtiva: 'contas' | 'departamentos';
  setVisaoAtiva: (value: 'contas' | 'departamentos') => void;
  hierarquia: DRENode[];
  hierarquiaDepartamentos: DRENode[];
  mesesPeriodo: MonthData[];
  columnWidths: {
    name: number;
    month: number;
    total: number;
    variation: number;
  };
  formatConfig: {
    nameColWidth: string;
    monthColWidth: string;
    totalColWidth: string;
    variationColWidth: string;
    fontSize: string;
    fontSizeValue: string;
    padding: string;
    headerPadding: string;
    rowGap: string;
    iconSize: string;
    expandBtnSize: string;
  };
  handleMouseDown: (e: React.MouseEvent, column: string) => void;
  renderNode: (node: DRENode, level: number) => React.ReactNode;
  isLoading: boolean;
}

export function DREFocusContent({
  visaoAtiva,
  setVisaoAtiva,
  hierarquia,
  hierarquiaDepartamentos,
  mesesPeriodo,
  columnWidths,
  formatConfig,
  handleMouseDown,
  renderNode,
  isLoading,
}: DREFocusContentProps) {
  return (
    <Tabs value={visaoAtiva} onValueChange={(v) => setVisaoAtiva(v as 'contas' | 'departamentos')} className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="contas" className="gap-2">
            <FileText className="h-4 w-4" />
            Por Contas
          </TabsTrigger>
          <TabsTrigger value="departamentos" className="gap-2">
            <Building2 className="h-4 w-4" />
            Por Departamentos
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Header da tabela */}
      <div className={`flex items-center bg-muted/80 border-y ${formatConfig.fontSize} font-semibold text-muted-foreground sticky top-0 z-20`}>
        <div 
          className={`${formatConfig.headerPadding} sticky left-0 bg-muted/80 z-10 border-r flex items-center justify-between group`}
          style={{ width: columnWidths.name, minWidth: columnWidths.name }}
        >
          <span>Descrição</span>
          <div 
            className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
            onMouseDown={(e) => handleMouseDown(e, 'name')}
          />
        </div>
        <div className="flex items-center flex-nowrap">
          {mesesPeriodo.map((mes, idx) => (
            <div 
              key={mes.key} 
              className="flex flex-col"
            >
              <div 
                className={`flex-shrink-0 text-center ${formatConfig.headerPadding} uppercase relative group`}
                style={{ width: columnWidths.month }}
              >
                {mes.label}
                {idx === 0 && (
                  <div 
                    className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                    onMouseDown={(e) => handleMouseDown(e, 'month')}
                  />
                )}
              </div>
              <div 
                className={`flex-shrink-0 text-center text-[9px] pb-1`}
                style={{ width: columnWidths.month }}
              >
                AV%
              </div>
            </div>
          ))}
          <div className="flex flex-col border-l-2 bg-muted/50">
            <div 
              className={`flex-shrink-0 text-center ${formatConfig.headerPadding} font-bold relative group`}
              style={{ width: columnWidths.total }}
            >
              TOTAL
              <div 
                className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                onMouseDown={(e) => handleMouseDown(e, 'total')}
              />
            </div>
            <div 
              className={`flex-shrink-0 text-center text-[9px] pb-1`}
              style={{ width: columnWidths.total }}
            >
              AV%
            </div>
          </div>
          <div 
            className={`flex-shrink-0 text-center ${formatConfig.headerPadding} border-l relative group`}
            style={{ width: columnWidths.variation }}
          >
            AH%
          </div>
        </div>
      </div>

      <TabsContent value="contas" className="m-0 flex-1">
        <ScrollArea className="h-[calc(95vh-200px)]">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="animate-pulse">Carregando dados financeiros...</div>
            </div>
          ) : (
            hierarquia.map(node => renderNode(node, 0))
          )}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="departamentos" className="m-0 flex-1">
        <ScrollArea className="h-[calc(95vh-200px)]">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="animate-pulse">Carregando dados financeiros...</div>
            </div>
          ) : hierarquiaDepartamentos.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum lançamento com departamento no período
            </div>
          ) : (
            hierarquiaDepartamentos.map(node => renderNode(node, 0))
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
