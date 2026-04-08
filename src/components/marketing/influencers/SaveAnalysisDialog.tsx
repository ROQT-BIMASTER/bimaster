import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, FolderOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VincularProjetoDialog } from "@/components/shared/VincularProjetoDialog";

interface SaveAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "patterns" | "suggestions" | "post";
  data: any;
  defaultTitle?: string;
}

const TYPE_LABELS: Record<string, string> = {
  patterns: "Análise de Performance",
  suggestions: "Sugestões de Conteúdo",
  post: "Postagem Gerada",
};

export function SaveAnalysisDialog({ open, onOpenChange, type, data, defaultTitle }: SaveAnalysisDialogProps) {
  const [titulo, setTitulo] = useState(defaultTitle || `${TYPE_LABELS[type]} - ${new Date().toLocaleDateString("pt-BR")}`);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showVinculo, setShowVinculo] = useState(false);

  const handleSaveGaleria = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: saved, error } = await supabase
        .from("content_intelligence_saves" as any)
        .insert({
          user_id: user.id,
          titulo,
          tipo: type,
          data_json: data,
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      setSavedId((saved as any).id);
      toast.success("Salvo na galeria com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLink = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: saved, error } = await supabase
        .from("content_intelligence_saves" as any)
        .insert({
          user_id: user.id,
          titulo,
          tipo: type,
          data_json: data,
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      setSavedId((saved as any).id);
      toast.success("Salvo! Agora vincule ao projeto.");
      setShowVinculo(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showVinculo} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" />
              Salvar Análise
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nome da análise" />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button onClick={handleSaveGaleria} disabled={saving || !titulo.trim()} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar na Galeria
              </Button>

              <Button onClick={handleSaveAndLink} disabled={saving || !titulo.trim()} variant="outline" className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderOpen className="h-4 w-4 mr-2" />}
                Salvar e Vincular a Projeto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {savedId && (
        <VincularProjetoDialog
          modulo="content_intelligence"
          registroId={savedId}
          open={showVinculo}
          onOpenChange={(v) => {
            setShowVinculo(v);
            if (!v) onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
