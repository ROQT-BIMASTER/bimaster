import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line, Area
} from "recharts";

// Paleta profissional de cores para gráficos
const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  success: 'hsl(var(--chart-2))',
  warning: 'hsl(var(--chart-3))',
  info: 'hsl(var(--chart-4))',
  danger: 'hsl(var(--chart-5))',
  muted: 'hsl(var(--muted-foreground))',
};

const GRADIENT_COLORS = [
  { start: '#3b82f6', end: '#1d4ed8' },  // Blue
  { start: '#10b981', end: '#059669' },  // Green
  { start: '#f59e0b', end: '#d97706' },  // Amber
  { start: '#8b5cf6', end: '#6d28d9' },  // Purple
  { start: '#ef4444', end: '#dc2626' },  // Red
  { start: '#06b6d4', end: '#0891b2' },  // Cyan
  { start: '#ec4899', end: '#db2777' },  // Pink
  { start: '#84cc16', end: '#65a30d' },  // Lime
];

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

// Tooltip customizado profissional
const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold">
              {typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface EvolutionChartProps {
  data: { mes: string; [key: string]: number | string }[];
  lines: { dataKey: string; name: string; color: string; type?: 'bar' | 'area' | 'line' }[];
  title: string;
  description?: string;
  height?: number;
}

export function EvolutionChart({ data, lines, title, description, height = 280 }: EvolutionChartProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {lines.map((line, idx) => (
                  <linearGradient key={line.dataKey} id={`gradient-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={line.color} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={line.color} stopOpacity={0.05}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(v) => formatCompact(v)}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
              {lines.map((line) => 
                line.type === 'bar' ? (
                  <Bar 
                    key={line.dataKey}
                    dataKey={line.dataKey} 
                    name={line.name}
                    fill={line.color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                ) : line.type === 'line' ? (
                  <Line
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={{ fill: line.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                ) : (
                  <Area
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                    fill={`url(#gradient-${line.dataKey})`}
                  />
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface HorizontalBarChartProps {
  data: { nome: string; nomeCompleto?: string; valor: number }[];
  title: string;
  description?: string;
  height?: number;
  showGradient?: boolean;
}

export function HorizontalBarChart({ data, title, description, height = 280, showGradient = true }: HorizontalBarChartProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                {GRADIENT_COLORS.map((g, i) => (
                  <linearGradient key={i} id={`barGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={g.start} />
                    <stop offset="100%" stopColor={g.end} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
              <XAxis 
                type="number" 
                tickFormatter={(v) => formatCompact(v)}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="nome" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={100}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                content={<CustomTooltip />}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.nomeCompleto || label}
              />
              <Bar 
                dataKey="valor" 
                name="Valor"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              >
                {data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={showGradient ? `url(#barGrad-${index % GRADIENT_COLORS.length})` : GRADIENT_COLORS[index % GRADIENT_COLORS.length].start}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface DonutChartProps {
  data: { nome: string; valor: number; qtd?: number }[];
  title: string;
  description?: string;
  height?: number;
  colorMap?: { [key: string]: string };
}

export function DonutChart({ data, title, description, height = 280, colorMap }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.valor, 0);
  
  const getColor = (nome: string, index: number) => {
    if (colorMap && colorMap[nome]) return colorMap[nome];
    return GRADIENT_COLORS[index % GRADIENT_COLORS.length].start;
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height }} className="flex items-center">
          <ResponsiveContainer width="60%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="valor"
                nameKey="nome"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getColor(entry.nome, index)}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Legend customizada */}
          <div className="w-[40%] space-y-1.5 pl-2">
            {data.slice(0, 6).map((entry, index) => {
              const percent = total > 0 ? ((entry.valor / total) * 100).toFixed(0) : '0';
              return (
                <div key={entry.nome} className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getColor(entry.nome, index) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{entry.nome}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {percent}%
                  </Badge>
                </div>
              );
            })}
            {data.length > 6 && (
              <p className="text-[10px] text-muted-foreground">+{data.length - 6} outros</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusBarChartProps {
  data: { nome: string; valor: number; qtd: number }[];
  title: string;
  description?: string;
  height?: number;
  colorMap?: { [key: string]: string };
}

export function StatusBarChart({ data, title, description, height = 280, colorMap }: StatusBarChartProps) {
  const getColor = (nome: string) => {
    if (colorMap && colorMap[nome]) return colorMap[nome];
    const defaultColors: { [key: string]: string } = {
      'Pago': '#10b981',
      'Recebido': '#10b981',
      'Pendente': '#f59e0b',
      'Vencido': '#ef4444',
      'Parcial': '#3b82f6',
    };
    return defaultColors[nome] || '#6b7280';
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="nome"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(v) => formatCompact(v)}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="valor" 
                name="Valor"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              >
                {data.map((entry) => (
                  <Cell key={entry.nome} fill={getColor(entry.nome)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Badges de quantidade */}
        <div className="flex justify-center gap-3 mt-2 pt-2 border-t">
          {data.map((entry) => (
            <div key={entry.nome} className="flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getColor(entry.nome) }}
              />
              <span className="text-xs text-muted-foreground">{entry.nome}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {entry.qtd}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { CHART_COLORS, GRADIENT_COLORS, formatCurrency, formatCompact };
