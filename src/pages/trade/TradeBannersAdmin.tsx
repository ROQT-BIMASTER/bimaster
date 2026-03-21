import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Image } from "lucide-react";
import { BannerListTable } from "@/components/trade/banners/BannerListTable";
import { BannerFormDialog } from "@/components/trade/banners/BannerFormDialog";
import type { TradeBanner } from "@/hooks/useTradeBanners";

const TradeBannersAdmin = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<TradeBanner | null>(null);

  const handleEdit = (banner: TradeBanner) => {
    setEditBanner(banner);
    setFormOpen(true);
  };

  const handleDuplicate = (banner: TradeBanner) => {
    setEditBanner(null);
    setFormOpen(true);
    // The form will open empty for a new banner — user copies what they need
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
