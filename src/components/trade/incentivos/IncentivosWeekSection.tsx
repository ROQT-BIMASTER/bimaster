import { useState, useEffect, useCallback } from "react";
import { useTradeIncentivos, useMyIncentivoProgresso } from "@/hooks/useTradeIncentivos";
import { IncentivoCard } from "./IncentivoCard";
import { Trophy, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function IncentivosWeekSection() {
  const { data: incentivos, isLoading } = useTradeIncentivos(true);
  const ids = incentivos?.map(i => i.id) || [];
  const { data: progressos } = useMyIncentivoProgresso(ids);

  const banners = incentivos?.filter(i => i.banner_url) || [];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  const nextSlide = useCallback(() => {
    if (banners.length > 1) setCurrentSlide(prev => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    if (banners.length > 1) setCurrentSlide(prev => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    const timer = setInterval(nextSlide, 7000);
    return () => clearInterval(timer);
  }, [paused, banners.length, nextSlide]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [banners.length]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!incentivos?.length) return null;

  return (
    <div className="space-y-4">
      {/* Header banner or carousel */}
      {banners.length > 0 ? (
        <div
          className="relative rounded-2xl overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div className="relative w-full aspect-[2.5/1] sm:aspect-[3/1]">
            {banners.map((b, idx) => (
              <img
                key={b.id}
                src={b.banner_url!}
                alt={b.titulo}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  idx === currentSlide ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            {/* Overlay text */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-end p-5">
              <div className="text-white">
                <h3 className="font-bold text-lg drop-shadow-md">
                  {banners[currentSlide]?.titulo || "Incentivos da Semana"}
                </h3>
                <p className="text-white/80 text-sm drop-shadow-md">Complete metas e ganhe recompensas!</p>
              </div>
            </div>
          </div>
          {banners.length > 1 && (
            <>
              <button onClick={prevSlide} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1 transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={nextSlide} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1 transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentSlide ? "w-6 bg-white" : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <Sparkles className="h-32 w-32 -mt-4 -mr-4" />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Incentivos da Semana</h3>
              <p className="text-white/80 text-sm">Complete metas e ganhe recompensas!</p>
            </div>
          </div>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {incentivos.map((incentivo) => {
          const progresso = progressos?.find(p => p.incentivo_id === incentivo.id);
          return (
            <IncentivoCard
              key={incentivo.id}
              incentivo={incentivo}
              progresso={progresso}
            />
          );
        })}
      </div>
    </div>
  );
}
