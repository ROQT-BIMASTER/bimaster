import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

export default function Pagamentos() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Pagamentos</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
