import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

interface ConfigOp {
  id: string;
  operacao: string;
  tipo: string;
  visivel: boolean;
}

export default function ConfigOperacoes() {
  const queryClient = useQueryClient();
  const [localChanges, setLocalChanges] = useState<Map<string, Partial<ConfigOp>>>(new Map());

  const { data: operacoes, isLoading } = useQuery({
    queryKey: ["config-operacoes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_operacoes")
        .select("*")
        .order("operacao");
      if (error) throw error;
      return data as ConfigOp[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Array.from(localChanges.entries());
      for (const [id, changes] of updates) {
        const { error } = await supabase
          .from("config_operacoes")
          .update(changes)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["config-operacoes-admin"] });
      setLocalChanges(new Map());
      toast.success("Configurações de operações salvas!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const updateLocal = (id: string, field: string, value: any) => {
    setLocalChanges((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) || {}), [field]: value });
      return next;
    });
  };

  const getEffective = (op: ConfigOp): ConfigOp => {
    const changes = localChanges.get(op.id);
    return changes ? { ...op, ...changes } : op;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Configurar Operações
        </CardTitle>
        {localChanges.size > 0 && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : `Salvar (${localChanges.size})`}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground mb-4">
          Defina quais operações são exibidas nos dashboards e se representam receita (positivo) ou devolução (negativo).
        </div>
        <div className="space-y-2">
          {(operacoes || []).map((op) => {
            const eff = getEffective(op);
            return (
              <div key={op.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{op.operacao}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tipo:</span>
                  <button
                    onClick={() => updateLocal(op.id, "tipo", eff.tipo === "positivo" ? "negativo" : "positivo")}
                    className="cursor-pointer"
                  >
                    <Badge variant={eff.tipo === "positivo" ? "default" : "destructive"} className="text-xs">
                      {eff.tipo === "positivo" ? "➕ Positivo" : "➖ Negativo"}
                    </Badge>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Visível:</span>
                  <Switch
                    checked={eff.visivel}
                    onCheckedChange={(v) => updateLocal(op.id, "visivel", v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
