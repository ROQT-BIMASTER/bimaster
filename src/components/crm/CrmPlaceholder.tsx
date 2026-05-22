import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

export default function CrmPlaceholder({ title, description }: Props) {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Construction className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta área está em construção. A estrutura, navegação e controle de acesso já estão prontos —
            os dados serão habilitados nas próximas entregas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
