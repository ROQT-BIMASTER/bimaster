import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, X } from "lucide-react";

interface Design {
  id: string;
  prompt: string;
  html_code: string | null;
  version_number: number;
  created_at: string;
}

interface Props {
  designs: Design[];
  onClose: () => void;
}

export const VersionCompare = ({ designs, onClose }: Props) => {
  if (designs.length < 2) return null;

  const [left, right] = [designs[0], designs[1]];

  const renderPreview = (design: Design) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">V{design.version_number}</Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(design.created_at).toLocaleDateString("pt-BR")}
        </span>
      </div>
      {design.html_code ? (
        <iframe
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"><style>body{margin:0;}</style></head><body>${design.html_code}</body></html>`}
          className="w-full h-[400px] border rounded-lg"
          sandbox="allow-scripts"
          title={`Version ${design.version_number}`}
        />
      ) : (
        <div className="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
          Sem preview disponível
        </div>
      )}
      <p className="text-xs text-muted-foreground line-clamp-2">{design.prompt}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4" /> Comparação de Versões
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderPreview(left)}
          {renderPreview(right)}
        </div>
      </CardContent>
    </Card>
  );
};
