import { usePhotoAnalysisQueue } from "@/hooks/usePhotoAnalysisQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const PhotoAnalysisStatus = () => {
  const [userId, setUserId] = useState<string>();
  const [reprocessing, setReprocessing] = useState(false);
  const { queue, pendingCount, loading, retryFailed } = usePhotoAnalysisQueue(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Detectar itens pendentes há mais de 5 minutos (fila travada)
  const hasStuckItems = useMemo(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return queue.some(
      (item) =>
        item.status === "pending" &&
        new Date(item.created_at).getTime() < fiveMinutesAgo,
    );
  }, [queue]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const { error } = await supabase.functions.invoke("trigger-photo-queue", {
        body: {},
      });
      if (error) throw error;
      toast.success("Processamento da fila acionado");
    } catch {
      toast.error("Falha ao acionar processamento");
    } finally {
      setReprocessing(false);
    }
  };

  if (loading || pendingCount === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {pendingCount} foto(s) sendo analisada(s) pela IA
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasStuckItems && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReprocess}
                disabled={reprocessing}
                className="h-7 text-xs"
              >
                {reprocessing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3 mr-1" />
                )}
                Reprocessar agora
              </Button>
            )}
            <Badge variant="outline">Em processamento</Badge>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="mt-3 space-y-2">
            {queue.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>
                  {item.status === 'pending' && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                  {item.status === 'processing' && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                  {item.status === 'completed' && <CheckCircle2 className="inline h-3 w-3 text-green-500 mr-1" />}
                  {item.status === 'failed' && <AlertCircle className="inline h-3 w-3 text-destructive mr-1" />}
                  Foto {item.photo_id.slice(0, 8)}...
                </span>
                {item.status === 'failed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => retryFailed(item.id)}
                    className="h-6 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Tentar novamente
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          As análises rodam automaticamente em segundo plano (a cada 2 min). Você pode continuar usando o app normalmente.
        </p>
      </CardContent>
    </Card>
  );
};
