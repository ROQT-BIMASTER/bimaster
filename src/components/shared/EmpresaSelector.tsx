import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { Skeleton } from "@/components/ui/skeleton";

interface EmpresaSelectorProps {
  /** Compact mode for header/sidebar */
  compact?: boolean;
  className?: string;
}

export function EmpresaSelector({ compact = false, className }: EmpresaSelectorProps) {
  const { empresaSelecionada, empresasDoUsuario, setEmpresaSelecionada, loading } = useEmpresaContext();
  const { data: userEmpresas } = useUserEmpresas();

  // Build set of primary empresa IDs
  const primaryIds = new Set(
    (userEmpresas || []).filter(ue => ue.is_primary).map(ue => ue.empresa_id)
  );

  if (loading) {
    return <Skeleton className={compact ? "h-8 w-[160px]" : "h-10 w-[220px]"} />;
  }

  if (empresasDoUsuario.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Sem empresa vinculada</span>
      </div>
    );
  }

  // If user has only one empresa, show it as static text
  if (empresasDoUsuario.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="truncate max-w-[180px]">{empresasDoUsuario[0].nome}</span>
      </div>
    );
  }

  const currentValue = empresaSelecionada ? String(empresaSelecionada.id) : "all";

  return (
    <Select
      value={currentValue}
      onValueChange={(val) => {
        setEmpresaSelecionada(val === "all" ? null : parseInt(val, 10));
      }}
    >
      <SelectTrigger className={compact ? "h-8 w-[180px] text-xs" : "h-10 w-[220px] text-sm"}>
        <div className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Selecionar empresa" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="font-medium">Todas as minhas empresas</span>
        </SelectItem>
        {empresasDoUsuario.map((empresa) => (
          <SelectItem key={empresa.id} value={String(empresa.id)}>
            <div className="flex items-center gap-2">
              <span className="truncate">{empresa.nome}</span>
              {empresa.cnpj && (
                <span className="text-muted-foreground text-xs ml-1">
                  {empresa.cnpj}
                </span>
              )}
              {primaryIds.has(empresa.id) && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  Principal
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
