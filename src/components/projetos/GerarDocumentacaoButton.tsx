import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissions } from "@/contexts/PermissionsContext";
import { getAuthHeaders } from "@/lib/utils/auth-headers";

export function GerarDocumentacaoButton() {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  if (!isAdmin) return null;

  const handleGenerar = async () => {
    if (!confirm("Isso criará 15 projetos de documentação com ~200+ tarefas. Continuar?")) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke("seed-system-projects", {
        method: "POST",
        headers,
        body: {},
      });

      if (error) throw error;

      toast.success(`${data.projetos?.length || 0} projetos criados com ${data.total_tarefas || 0} tarefas!`);
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-metrics"] });
    } catch (err: any) {
      toast.error("Erro ao gerar projetos: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleGenerar} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
      {loading ? "Gerando..." : "Gerar Documentação"}
    </Button>
  );
}
