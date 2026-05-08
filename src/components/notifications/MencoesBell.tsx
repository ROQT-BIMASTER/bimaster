import { useNavigate } from "react-router-dom";
import { AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMencoesNotifications } from "@/hooks/useMencoesNotifications";
import { MencoesList } from "@/components/projetos/central/MencoesList";

export const MencoesBell = () => {
  const navigate = useNavigate();
  const { mencoes, isLoading, naoLidas, marcarLida, remover } = useMencoesNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Menções${naoLidas > 0 ? ` - ${naoLidas} não lidas` : ""}`}
          title="Menções para você"
        >
          <AtSign className="h-5 w-5" />
          {naoLidas > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-xs animate-pulse"
            >
              {naoLidas > 9 ? "9+" : naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <AtSign className="h-4 w-4" /> Menções
          </h3>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => marcarLida.mutate(mencoes.filter(m => !m.read).map(m => m.id))}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          <MencoesList
            mencoes={mencoes.slice(0, 30)}
            isLoading={isLoading}
            onMarcarLida={(ids) => marcarLida.mutate(ids)}
            onRemover={(ids) => remover.mutate(ids)}
          />
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate("/dashboard/projetos/central?tab=mencoes")}
          >
            Ver todas as menções
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
