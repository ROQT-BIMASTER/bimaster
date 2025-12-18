import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdsMetricsChartsProps {
  metrics: any[];
  dateRange: { start: Date; end: Date };
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

const platformColors: Record<string, string> = {
  google_ads: '#4285f4',
  meta_ads: '#1877f2',
  analytics: '#f57c00',
  tiktok_ads: '#000000',
  linkedin_ads: '#0a66c2'
};

export function AdsMetricsCharts({ metrics, dateRange }: AdsMetricsChartsProps) {
  // Process data for charts
  const chartData = useMemo(() => {
    // Create a map of all dates in range
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const dateMap = new Map<string, any>();
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      dateMap.set(dateStr, {
        date: dateStr,
        displayDate: format(day, 'dd/MM', { locale: ptBR }),
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversionValue: 0,
        google_ads_spend: 0,
        meta_ads_spend: 0,
        analytics_sessions: 0
      });
    });

    // Aggregate metrics by date
    metrics.forEach(m => {
      const existing = dateMap.get(m.metric_date);
      if (existing) {
        existing.impressions += Number(m.impressions || 0);
        existing.clicks += Number(m.clicks || 0);
        existing.spend += Number(m.spend || 0);
        existing.conversions += Number(m.conversions || 0);
        existing.conversionValue += Number(m.conversion_value || 0);
        
        const platform = m.ads_accounts?.platform;
        if (platform === 'google_ads') existing.google_ads_spend += Number(m.spend || 0);
        if (platform === 'meta_ads') existing.meta_ads_spend += Number(m.spend || 0);
      }
    });

    // Calculate CTR and CPC for each day
    return Array.from(dateMap.values()).map(d => ({
      ...d,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0,
      cpc: d.clicks > 0 ? (d.spend / d.clicks) : 0,
      roas: d.spend > 0 ? (d.conversionValue / d.spend) : 0
    }));
  }, [metrics, dateRange]);

  // Platform distribution for pie chart
  const platformDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    metrics.forEach(m => {
      const platform = m.ads_accounts?.platform || 'other';
      dist[platform] = (dist[platform] || 0) + Number(m.spend || 0);
    });
    return Object.entries(dist).map(([name, value]) => ({
      name: name === 'google_ads' ? 'Google Ads' : 
            name === 'meta_ads' ? 'Meta Ads' : 
            name === 'analytics' ? 'Analytics' : name,
      value,
      color: platformColors[name] || '#888888'
    }));
  }, [metrics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Nenhum dado disponível para gerar gráficos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Spend Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investimento ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayDate" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="spend" 
                  name="Investimento"
                  stroke="#3b82f6" 
                  fill="url(#colorSpend)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Impressions and Clicks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impressões e Cliques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={formatNumber} />
                  <Tooltip formatter={(v: number) => formatNumber(v)} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="impressions" 
                    name="Impressões"
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicks" 
                    name="Cliques"
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ROAS Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ROAS ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRoas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(1) + 'x'} />
                  <Tooltip formatter={(v: number) => v.toFixed(2) + 'x'} />
                  <Area 
                    type="monotone" 
                    dataKey="roas" 
                    name="ROAS"
                    stroke="#10b981" 
                    fill="url(#colorRoas)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* CTR and CPC */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CTR e CPC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(v) => v.toFixed(1) + '%'} 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(v) => 'R$' + v.toFixed(0)} 
                  />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="ctr" 
                    name="CTR (%)"
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="cpc" 
                    name="CPC (R$)"
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {platformDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversions Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversões Diárias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="conversions" 
                  name="Conversões"
                  fill="#8b5cf6" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
