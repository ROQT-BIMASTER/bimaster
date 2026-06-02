import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Users,
  Trash2,
  ShieldCheck,
  BookmarkPlus,
  Palette,
  Rows3,
  Rows4,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoBgColorPicker } from "./ProjetoBgColorPicker";
import { useTarefaDensity } from "@/hooks/useTarefaDensity";
import { EditarProjetoDialog } from "./EditarProjetoDialog";

interface Props {
  projetoId: string;
  bgCor: string | null;
  onBgCorChange: (cor: string | null) => void;
  onAbrirMembros: () => void;
  onAbrirLixeira: () => void;
  onSalvarComoModelo: () => void;
  lixeiraBadgeCount?: number;
  className?: string;
  triggerClassName?: string;
}

/**
 * Menu único de Configurações do projeto: cor de fundo, membros, densidade,
 * fluxos de aprovação, salvar como modelo e lixeira. Substitui a poluição de
 * ícones soltos no header do detalhe do projeto.
 */
export function ProjetoSettingsMenu({
  projetoId,
  bgCor,
  onBgCorChange,
  onAbrirMembros,
  onAbrirLixeira,
  onSalvarComoModelo,
  lixeiraBadgeCount = 0,
  className,
  triggerClassName,
}: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const { isCompact, toggle: toggleDensity } = useTarefaDensity();
  const DensityIcon = isCompact ? Rows4 : Rows3;

  const handle = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 rounded-full relative", triggerClassName)}
          title="Configurações do projeto"
          aria-label="Configurações do projeto"
        >
          <Settings className="h-4 w-4" />
          {lixeiraBadgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-3.5 min-w-3.5 flex items-center justify-center px-0.5">
              {lixeiraBadgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("w-64 p-2", className)}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Configurações do projeto
        </p>

        <button
          type="button"
          onClick={handle(() => setEditarOpen(true))}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span>Editar projeto</span>
        </button>

        <button
          type="button"
          onClick={handle(onAbrirMembros)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Membros do projeto</span>
        </button>

        <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 text-sm">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span>Cor de fundo</span>
          </div>
          <ProjetoBgColorPicker value={bgCor} onChange={onBgCorChange} />
        </div>

        <button
          type="button"
          onClick={handle(toggleDensity)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2">
            <DensityIcon className="h-4 w-4 text-muted-foreground" />
            <span>Densidade</span>
          </div>
          <span className="text-[11px] text-muted-foreground capitalize">
            {isCompact ? "Compacta" : "Confortável"}
          </span>
        </button>

        <Separator className="my-1" />

        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Aprovações & modelos
        </p>

        <button
          type="button"
          onClick={handle(() => navigate(`/dashboard/projetos/${projetoId}/aprovacoes`))}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span>Kanban de aprovações</span>
        </button>

        <button
          type="button"
          onClick={handle(() => navigate("/admin/templates-alcadas"))}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span>Configurar fluxos de alçadas</span>
        </button>

        <button
          type="button"
          onClick={handle(onSalvarComoModelo)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <BookmarkPlus className="h-4 w-4 text-muted-foreground" />
          <span>Salvar como modelo</span>
        </button>

        <Separator className="my-1" />

        <button
          type="button"
          onClick={handle(onAbrirLixeira)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <span>Lixeira</span>
          </div>
          {lixeiraBadgeCount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
              {lixeiraBadgeCount}
            </span>
          )}
        </button>
      </PopoverContent>
    </Popover>
  );
}
