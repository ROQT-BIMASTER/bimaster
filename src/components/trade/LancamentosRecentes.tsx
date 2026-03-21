import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TradeSectionHeader } from "@/components/trade/ui/TradeSectionHeader";
import { formatLocalDate } from "@/utils/dateUtils";
import { useEffect, useState } from "react";

export function LancamentosRecentes() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: visits, isLoading } = useQuery({
    queryKey: ["lancamentos-recentes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("id, scheduled_date, status, store:stores(name)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const visitIds = data.map((v) => v.id);

      const { data: photos } = await supabase
        .from("photos")
        .select("visit_id, photo_url, thumbnail_url")
        .in("visit_id", visitIds);

      const photoMap = new Map<string, string>();
      photos?.forEach((p) => {
        if (p.visit_id && !photoMap.has(p.visit_id)) {
          photoMap.set(p.visit_id, p.thumbnail_url || p.photo_url);
        }
      });

      return data.map((v) => ({
        id: v.id,
        storeName: (v.store as any)?.name || "Loja",
        date: v.scheduled_date,
        status: v.status,
        photoUrl: photoMap.get(v.id) || null,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <TradeSectionHeader title="Lançamentos Recentes" />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 min-w-[72px]">
              <Skeleton className="w-16 h-16 rounded-2xl" />
              <Skeleton className="w-12 h-3 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!visits || visits.length === 0) return null;

  return (
    <div className="space-y-2">
      <TradeSectionHeader title="Lançamentos Recentes" />
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {visits.map((v) => (
          <div
            key={v.id}
            className="flex flex-col items-center gap-1.5 min-w-[72px] max-w-[72px]"
          >
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center shadow-sm border border-border">
              {v.photoUrl ? (
                <img
                  src={v.photoUrl}
                  alt={v.storeName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Store className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <span className="text-[11px] text-foreground font-medium text-center leading-tight line-clamp-2">
              {v.storeName.split(" ")[0]}
            </span>
            <span className="text-[9px] text-muted-foreground -mt-1">
              {formatLocalDate(v.date, "dd/MM")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
