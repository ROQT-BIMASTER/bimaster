import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEV_STATUS_OPTIONS, STATUS_TRANSITIONS, logDocAudit } from "@/lib/productDocAudit";
import { cn } from "@/lib/utils";
import { ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

interface ProductDevStatusBarProps {
  produtoId: string;
  projetoId: string;
  userPapel?: string;
}

export function ProductDevStatusBar({ produtoId, projetoId, userPapel }: ProductDevStatusBarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: devStatus } = useQuery({
    queryKey: ["produto_dev_status", produtoId, projetoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("produto_dev_status" as any)
        .select("*")
        .eq("produto_id", produtoId)
        .eq("projeto_id", projetoId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!produtoId && !!projetoId,
  });

  const currentStatus = devStatus?.status || "submissao_criada";
  const currentIndex = DEV_STATUS_OPTIONS.findIndex(s => s.value === currentStatus);

  const allowedTransitions = userPapel ? (STATUS_TRANSITIONS[userPapel] || []) : [];

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (devStatus) {
        await supabase
          .from("produto_dev_status" as any)
          .update({ status: newStatus, updated_by: user!.id, updated_at: new Date().toISOString() } as any)
          .eq("id", devStatus.id);
      } else {
        await supabase
          .from("produto_dev_status" as any)
          .insert({ produto_id: produtoId, projeto_id: projetoId, status: newStatus, updated_by: user!.id } as any);
      }
      await logDocAudit({
        produtoId,
        projetoId,
        acao: "status_change",
        detalhes: { from: currentStatus, to: newStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_dev_status", produtoId, projetoId] });
      toast.success("Status atualizado!");
      setPopoverOpen(false);
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1">
      {DEV_STATUS_OPTIONS.map((status, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = status.value === currentStatus;

        return (
          <div key={status.value} className="flex items-center">
            {index > 0 && (
              <ChevronRight className={cn("h-3 w-3 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground/30")} />
            )}
            <Popover open={isCurrent && popoverOpen} onOpenChange={v => isCurrent && setPopoverOpen(v)}>
              <PopoverTrigger asChild>
                <Badge
                  variant={isCurrent ? "default" : isActive ? "secondary" : "outline"}
                  className={cn(
                    "text-[10px] whitespace-nowrap cursor-pointer transition-all",
                    isCurrent && "ring-2 ring-primary/30",
                    !isActive && "opacity-40"
                  )}
                >
                  {isCurrent && <Check className="h-3 w-3 mr-0.5" />}
                  {status.label}
                </Badge>
              </PopoverTrigger>
              {isCurrent && allowedTransitions.length > 0 && (
                <PopoverContent className="w-48 p-2" align="start">
                  <p className="text-xs font-medium mb-2">Avançar para:</p>
                  <div className="space-y-1">
                    {DEV_STATUS_OPTIONS.filter(s => 
                      allowedTransitions.includes(s.value) && s.value !== currentStatus
                    ).map(s => (
                      <Button
                        key={s.value}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => updateStatus.mutate(s.value)}
                        disabled={updateStatus.isPending}
                      >
                        <div className={cn("h-2 w-2 rounded-full mr-2", s.color)} />
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>
        );
      })}
    </div>
  );
}
