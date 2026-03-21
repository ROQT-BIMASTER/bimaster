import { useState, useEffect, useCallback } from "react";
import { useActiveTradeBanners } from "@/hooks/useTradeBanners";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function TradeHeroBanner() {
  const { data: banners, isLoading } = useActiveTradeBanners();
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    if (!banners?.length) return;
    setCurrent((c) => (c + 1) % banners.length);
  }, [banners?.length]);

  const prev = useCallback(() => {
    if (!banners?.length) return;
    setCurrent((c) => (c - 1 + banners.length) % banners.length);
  }, [banners?.length]);

  useEffect(() => {
    if (!banners?.length || banners.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, banners?.length]);

  if (isLoading) {
    return <Skeleton className="w-full h-40 sm:h-48 rounded-2xl" />;
  }

  if (!banners?.length) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl group">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => (
          <div key={banner.id} className="w-full flex-shrink-0">
            <a
              href={banner.link_destino || "#"}
              target={banner.link_destino?.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={banner.imagem_url}
                alt={banner.titulo}
                className="w-full h-40 sm:h-48 object-cover rounded-2xl"
              />
            </a>
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === current ? "w-6 bg-white" : "w-2 bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
