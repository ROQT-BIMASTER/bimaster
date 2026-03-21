import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Wand2, Loader2 } from "lucide-react";
import { BannerListTable } from "@/components/trade/banners/BannerListTable";
import { BannerFormDialog } from "@/components/trade/banners/BannerFormDialog";
import { useTradeBanners, type TradeBanner, useUpdateBanner } from "@/hooks/useTradeBanners";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TradeBannersAdmin = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<TradeBanner | null>(null);
  const [optimizingAll, setOptimizingAll] = useState(false);
  const { data: banners = [] } = useTradeBanners();
  const updateBanner = useUpdateBanner();

  const handleEdit = (banner: TradeBanner) => {
    setEditBanner(banner);
    setFormOpen(true);
  };

  const handleDuplicate = (banner: TradeBanner) => {
    setEditBanner(null);
    setFormOpen(true);
  };

  const handleOptimizeAll = async () => {
    if (!banners.length) return;
    setOptimizingAll(true);
    let success = 0;
    let failed = 0;

    for (const banner of banners) {
      if (!banner.imagem_url) { failed++; continue; }
      try {
        toast.info(`🤖 Otimizando "${banner.titulo}"...`);
        const { data, error } = await supabase.functions.invoke("optimize-banner-image", {
          body: { imageUrl: banner.imagem_url },
        });
        if (error || data?.error || !data?.optimizedImage) { failed++; continue; }

        const parts = (data.optimizedImage as string).split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
        const bytes = atob(parts[1]);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });

        const path = `${Date.now()}_opt_${banner.id.slice(0, 8)}.png`;
        const { error: upErr } = await supabase.storage.from("trade-banners").upload(path, blob);
        if (upErr) { failed++; continue; }

        const { data: { publicUrl } } = supabase.storage.from("trade-banners").getPublicUrl(path);
        await updateBanner.mutateAsync({ id: banner.id, imagem_url: publicUrl });
        success++;
      } catch {
        failed++;
      }
    }

    setOptimizingAll(false);
    toast.success(`✅ ${success} banner(s) otimizado(s)${failed > 0 ? `, ${failed} falha(s)` : ""}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20 sm:pb-6">
        <div className="flex items-center gap-4 px-1">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/trade/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Gerenciar Banners</h1>
            <p className="text-sm text-muted-foreground">Carrossel do módulo Trade Marketing</p>
          </div>
          <Button
            variant="outline"
            onClick={handleOptimizeAll}
            disabled={optimizingAll || !banners.length}
            className="gap-1.5"
          >
            {optimizingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Otimizar Todos com IA
          </Button>
          <Button onClick={() => { setEditBanner(null); setFormOpen(true); }} className="bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white hover:brightness-110">
            <Plus className="h-4 w-4 mr-1" /> Novo Banner
          </Button>
        </div>

        <BannerListTable onEdit={handleEdit} onDuplicate={handleDuplicate} />
        <BannerFormDialog open={formOpen} onOpenChange={setFormOpen} editBanner={editBanner} />
      </div>
    </DashboardLayout>
  );
};

export default TradeBannersAdmin;
