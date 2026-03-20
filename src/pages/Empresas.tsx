import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function Empresas() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Empresas</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
