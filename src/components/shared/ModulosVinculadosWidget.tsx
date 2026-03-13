import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Layers } from "lucide-react";
import { useVinculosDaTarefa, MODULO_LABELS } from "@/hooks/useModuloVinculos";

interface Props {
  tarefaId: string | undefined;
}

export function ModulosVinculadosWidget({ tarefaId }: Props) {
  const navigate = useNavigate();
  const { data: vinculos = [], isLoading } = useVinculosDaTarefa(tarefaId);

  if (!tarefaId || (vinculos.length === 0 && !isLoading)) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Módulos Vinculados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {vinculos.map((v) => {
          const info = MODULO_LABELS[v.modulo] || { label: v.modulo, icon: "📋", route: "#" };
          return (
            <div
              key={v.id}
              className="flex items-center gap-2 rounded-md border border-border p-2 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => navigate(info.route)}
            >
              <span className="text-sm">{info.icon}</span>
              <span className="flex-1 text-xs font-medium">{info.label}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
