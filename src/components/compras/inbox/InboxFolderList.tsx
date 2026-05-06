import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Inbox, FileEdit, Hourglass, Factory, Ship, Compass, FileCheck2, PackageCheck, AlertTriangle,
} from "lucide-react";
import type { InboxFolder } from "@/hooks/useCompradorInboxOCs";

interface InboxFolderListProps {
  active: InboxFolder;
  onSelect: (f: InboxFolder) => void;
  counts: Record<InboxFolder, number>;
}

const folders: { key: InboxFolder; label: string; icon: any; tone?: "destructive" }[] = [
  { key: "todas", label: "Caixa de entrada", icon: Inbox },
  { key: "rascunho", label: "Rascunhos", icon: FileEdit },
  { key: "aguardando", label: "Aguardando aprovação", icon: Hourglass },
  { key: "producao", label: "Em produção", icon: Factory },
  { key: "embarcadas", label: "Embarcadas", icon: Ship },
  { key: "transito", label: "Em trânsito", icon: Compass },
  { key: "desembaraco", label: "Desembaraço", icon: FileCheck2 },
  { key: "recebidas", label: "Recebidas", icon: PackageCheck },
  { key: "atrasadas", label: "Atrasadas", icon: AlertTriangle, tone: "destructive" },
];

export function InboxFolderList({ active, onSelect, counts }: InboxFolderListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-0.5">
        {folders.map((f) => {
          const Icon = f.icon;
          const isActive = active === f.key;
          const count = counts[f.key] || 0;
          return (
            <Button
              key={f.key}
              variant="ghost"
              size="sm"
              onClick={() => onSelect(f.key)}
              className={cn(
                "w-full justify-start gap-2 px-2 h-9 font-normal",
                isActive && "bg-primary/10 text-primary font-medium hover:bg-primary/15",
                f.tone === "destructive" && !isActive && "text-destructive/80",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1 text-left">{f.label}</span>
              {count > 0 && (
                <Badge
                  variant={f.tone === "destructive" ? "destructive" : "secondary"}
                  className="h-5 px-1.5 text-[10px] tabular-nums"
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
