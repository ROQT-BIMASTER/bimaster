import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MetricHistory {
  platform: string;
  created_at: string;
  followers: number;
  engagement: number;
  posts: number;
  reach: number;
}

interface SocialMediaChartsProps {
  platform?: string;
}

export function SocialMediaCharts({ platform }: SocialMediaChartsProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<MetricHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHistoricalData(); }, [platform]);

  const loadHistoricalData = async () => {
    try {
      setLoading(true);
      let query = supabase.from("social_media_metrics_history").select("*").order("created_at", { ascending: true }).limit(30);
      if (platform && platform !== "all") query = query.eq("platform", platform);
      const { data: historyData, error } = await query;
      if (error) throw error;
      setData(historyData || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  const chartData = data.map((item) => ({
    date: new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    followers: item.followers,
    engagement: parseFloat(item.engagement?.toString() || "0"),
    posts: item.posts,
    reach: item.reach,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{t("mkt.followers_evolution")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="followers" stroke="hsl(var(--primary))" strokeWidth={2} name={t("mkt.followers")} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("mkt.engagement_reach")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" />
              <Tooltip /><Legend />
              <Bar yAxisId="left" dataKey="engagement" fill="hsl(var(--chart-1))" name={t("mkt.engagement_pct")} />
              <Bar yAxisId="right" dataKey="reach" fill="hsl(var(--chart-2))" name={t("mkt.reach")} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("mkt.publications")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="posts" stroke="hsl(var(--chart-3))" strokeWidth={2} name={t("mkt.publications")} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
