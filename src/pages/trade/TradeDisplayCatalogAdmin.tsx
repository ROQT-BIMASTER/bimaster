import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Wand2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTradeDisplays, useDeleteDisplay, useCreateDisplay, useUpdateDisplay, TradeDisplay } from "@/hooks/useTradeDisplays";
import { DisplayCatalogGrid } from "@/components/trade/displays/DisplayCatalogGrid";
import { DisplayFormDialog } from "@/components/trade/displays/DisplayFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TradeDisplayCatalogAdmin = () => {
  const { data: displays = [], isLoading } = useTradeDisplays();
  const deleteDisplay = useDeleteDisplay();
  const duplicateDisplay = useCreateDisplay();
  const updateDisplay = useUpdateDisplay();

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<TradeDisplay | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TradeDisplay | null>(null);
  const [bulkOptimizing, setBulkOptimizing] = useState(false);

  const handleSelect = (display: TradeDisplay) => {
    setSelected(display);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelected(null);
    setFormOpen(true);
  };

  const handleDuplicate = async (display: TradeDisplay) => {
    const { id, created_at, updated_at, ...rest } = display;
    await duplicateDisplay.mutateAsync({ ...rest, nome: `${rest.nome} (cópia)` });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDisplay.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleBulkOptimize = async () => {
    const withImages = displays.filter((d) => d.foto_url);
    if (!withImages.length) {
      toast.info("Nenhum display com imagem para otimizar");
      return;
    }

    setBulkOptimizing(true);
    let success = 0;
    let failed = 0;

    for (const d of withImages) {
      try {
        toast.info(`🤖 Otimizando ${d.nome}...`);
        const { data, error } = await supabase.functions.invoke("optimize-display-banner", {
          body: { imageUrl: d.foto_url },
        });
        if (error || !data?.optimizedImage) { failed++; continue; }

        const b64 = data.optimizedImage.replace(/^data:image\/\w+;base64,/, "");
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "image/png" });

        const path = `displays/${Date.now()}_opt_${d.id.slice(0, 8)}.png`;
        const { error: upErr } = await supabase.storage.from("trade-banners").upload(path, blob, { upsert: false });
        if (upErr) { failed++; continue; }

        const { data: urlData } = supabase.storage.from("trade-banners").getPublicUrl(path);
        await updateDisplay.mutateAsync({ id: d.id, foto_url: urlData.publicUrl });
        success++;
      } catch {
        failed++;
      }
    }

    setBulkOptimizing(false);
    toast.success(`✨ ${success} otimizados${failed ? `, ${failed} falharam` : ""}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/trade/admin">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Catálogo de Displays</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie os displays e expositores do Trade
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleBulkOptimize} 
              disabled={bulkOptimizing}
              variant="outline"
              className="rounded-xl"
            >
              {bulkOptimizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              {bulkOptimizing ? "Otimizando..." : "Otimizar Todos com IA"}
            </Button>
            <Button onClick={handleNew} className="bg-[hsl(330,81%,60%)] hover:bg-[hsl(330,81%,50%)] text-white rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Novo Display
            </Button>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <DisplayCatalogGrid displays={displays} onSelect={handleSelect} showStatus />
        )}

        {/* Form Dialog */}
        <DisplayFormDialog open={formOpen} onOpenChange={setFormOpen} display={selected} />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir display?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. O display "{deleteTarget?.nome}" será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default TradeDisplayCatalogAdmin;
