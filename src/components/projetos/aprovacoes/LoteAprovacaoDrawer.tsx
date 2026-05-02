import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { LoteAprovacaoCard } from "./LoteAprovacaoCard";
import type { AprovacaoConsolidado } from "@/hooks/useAprovacoesConsolidado";
import type { LoteAprovacao } from "@/hooks/useLoteAprovacao";

interface Props {
  item: AprovacaoConsolidado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function LoteAprovacaoDrawer({ item, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  if (!item) return null;

  // Adapta consolidado → LoteAprovacao para reuso do card existente
  const loteCompat: LoteAprovacao = {
    id: item.id,
    config_id: item.config_id,
    tarefa_id: item.tarefa_id,
    secao_id: item.secao_id,
    projeto_id: item.projeto_id,
    lote_nome: item.lote_nome,
    titulo: item.titulo,
    descricao: null,
    status: item.status,
    etapa_atual_ordem: item.etapa_atual_ordem,
    rodada: item.rodada,
    prazo_lote: item.prazo_lote,
    politica_movimentacao: "continuar",
    created_at: item.created_at,
    created_by: item.created_by,
  };

  const breadcrumb = [item.projeto_nome, item.secao_nome, item.tarefa_titulo]
    .filter(Boolean)
    .join(" › ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-base">
            {item.lote_nome || item.titulo || "Lote de aprovação"}
          </SheetTitle>
          {breadcrumb && (
            <SheetDescription className="text-xs">{breadcrumb}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <LoteAprovacaoCard lote={loteCompat} />

          {item.tarefa_id && item.projeto_id && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/dashboard/projetos/${item.projeto_id}?tarefa=${item.tarefa_id}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Abrir tarefa no projeto
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
