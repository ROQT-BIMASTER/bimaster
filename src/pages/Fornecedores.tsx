import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function Fornecedores() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Fornecedores</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de Fornecedores</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
