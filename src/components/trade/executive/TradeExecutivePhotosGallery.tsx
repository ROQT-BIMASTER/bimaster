import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Camera, Sparkles, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RecentPhoto } from "@/hooks/useTradeExecutiveDashboard";
import { useLanguage } from "@/contexts/LanguageContext";

interface TradeExecutivePhotosGalleryProps {
  data?: RecentPhoto[];
  isLoading: boolean;
}

export function TradeExecutivePhotosGallery({ data, isLoading }: TradeExecutivePhotosGalleryProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {t("trade_exec.recent_photos")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          {t("trade_exec.recent_photos")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.map((photo) => (
              <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                {photo.url ? (
                  <img src={photo.url} alt={photo.pdv} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Camera className="h-8 w-8 text-muted-foreground" /></div>
                )}
                <div className="absolute top-2 right-2">
                  {photo.iaStatus === "processed" ? (
                    <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1 text-[10px] px-1.5">
                      <Sparkles className="h-3 w-3" />
                      {photo.iaScore ? photo.iaScore.toFixed(0) : "IA"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-[10px] px-1.5">
                      <Clock className="h-3 w-3" />
                      {t("trade_exec.pending")}
                    </Badge>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <p className="text-xs font-medium truncate">{photo.pdv}</p>
                    <p className="text-[10px] opacity-80">{photo.data ? format(parseISO(photo.data), "dd/MM HH:mm", { locale: ptBR }) : "-"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">{t("trade_exec.no_photos")}</div>
        )}
      </CardContent>
    </Card>
  );
}
