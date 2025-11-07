import { usePhotoAnalysisQueue } from "@/hooks/usePhotoAnalysisQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const PhotoAnalysisStatus = () => {
  const [userId, setUserId] = useState<string>();
  const { queue, pendingCount, loading, retryFailed } = usePhotoAnalysisQueue(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

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
          <Badge variant="outline" className="ml-2">
            Em processamento
          </Badge>
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
          As análises são processadas automaticamente em segundo plano. Você pode continuar usando o app normalmente.
        </p>
      </CardContent>
    </Card>
  );
};
