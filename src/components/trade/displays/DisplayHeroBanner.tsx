import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveTradeDisplays } from "@/hooks/useTradeDisplays";
import { ChevronLeft, ChevronRight, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export function DisplayHeroBanner() {
  const { data: displays, isLoading } = useActiveTradeDisplays();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setCurrent((c) => (displays?.length ? (c + 1) % displays.length : 0));
      }
    }, 7000);
  }, [displays?.length]);

  const next = useCallback(() => {
    if (!displays?.length) return;
    setCurrent((c) => (c + 1) % displays.length);
    startTimer();
  }, [displays?.length, startTimer]);

  const prev = useCallback(() => {
    if (!displays?.length) return;
    setCurrent((c) => (c - 1 + displays.length) % displays.length);
    startTimer();
  }, [displays?.length, startTimer]);

  const pause = useCallback(() => { pausedRef.current = true; }, []);
  const resume = useCallback(() => { pausedRef.current = false; }, []);

  useEffect(() => {
    if (!displays?.length || displays.length <= 1) return;
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer, displays?.length]);

  if (isLoading) return <Skeleton className="w-full h-44 sm:h-52 rounded-2xl" />;
  if (!displays?.length) return null;

  const display = displays[current];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl group"
      onTouchStart={pause}
      onTouchEnd={resume}
      onMouseDown={pause}
      onMouseUp={resume}
      onMouseLeave={resume}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {displays.map((d) => (
          <div key={d.id} className="w-full flex-shrink-0 relative">
            <Link to="/dashboard/trade/admin/displays" className="block">
              {d.foto_url ? (
                <img
                  src={d.foto_url}
                  alt={d.nome}
                  className="w-full h-44 sm:h-52 object-cover rounded-2xl"
                />
              ) : (
                <div className="w-full h-44 sm:h-52 rounded-2xl bg-gradient-to-br from-[hsl(330,81%,60%)] to-[hsl(262,83%,58%)] flex items-center justify-center">
                  <Ruler className="h-12 w-12 text-white/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-2xl" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                <div>
                  <p className="text-white font-bold text-sm sm:text-base drop-shadow-md">{d.nome}</p>
                  {(d.largura_cm || d.altura_cm) && (
                    <p className="text-white/80 text-xs mt-0.5">
                      {[d.largura_cm && `${d.largura_cm}cm`, d.profundidade_cm && `${d.profundidade_cm}cm`, d.altura_cm && `${d.altura_cm}cm`]
                        .filter(Boolean)
                        .join(" × ")}
                    </p>
                  )}
                </div>
                {d.categoria && (
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px] backdrop-blur-sm">
                    {d.categoria}
                  </Badge>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>

      {displays.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {displays.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); startTimer(); }}
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
