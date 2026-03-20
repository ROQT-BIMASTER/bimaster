import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";

export default function CentrosCusto() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Centros de Custo</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Centros de Custo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
