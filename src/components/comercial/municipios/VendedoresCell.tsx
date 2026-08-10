import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Clock } from "lucide-react";
import { MunicipioVendedor } from "@/hooks/useMunicipiosIntelligence";
import { parseLocalDate } from "@/utils/dateUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatData(value: string | null): string {
  if (!value) return "sem compra registrada";
  const d = parseLocalDate(value.slice(0, 10));
  if (!d) return "sem compra registrada";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

interface Props {
  vendedores: MunicipioVendedor[];
  fallback?: string | null;
}

export function VendedoresCell({ vendedores, fallback }: Props) {
  const lista = [...(vendedores || [])].sort((a, b) => {
    if (a.mais_recente !== b.mais_recente) return a.mais_recente ? -1 : 1;
    return (b.clientes || 0) - (a.clientes || 0);
  });

  if (lista.length === 0) {
    return <span className="text-xs text-muted-foreground">{fallback || "-"}</span>;
  }

  const principal = lista[0];
  const extras = lista.length - 1;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-left text-xs hover:underline"
        >
          <span className="truncate max-w-[140px]">{principal.nome}</span>
          {principal.mais_recente && (
            <Badge variant="success" className="h-4 px-1 text-[10px]">
              recente
            </Badge>
          )}
          {extras > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              +{extras}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">
            {lista.length === 1 ? "1 vendedor no município" : `${lista.length} vendedores no município`}
          </span>
        </div>
        <div className="space-y-2">
          {lista.map((v) => (
            <div key={v.nome} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{v.nome}</span>
                {v.mais_recente && (
                  <Badge variant="success" className="h-4 px-1 text-[10px] shrink-0">
                    venda mais recente
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Última compra: {formatData(v.ultima_compra)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {v.clientes} {v.clientes === 1 ? "cliente" : "clientes"}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
