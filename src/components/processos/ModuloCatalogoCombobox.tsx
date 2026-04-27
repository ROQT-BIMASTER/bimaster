import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModuloCatalogo } from "@/hooks/useModuloCatalogo";

interface Props {
  value?: string;
  onChange: (codigo: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  excludeCodigos?: string[];
}

export function ModuloCatalogoCombobox({ value, onChange, placeholder = "Selecione um módulo", className, disabled, excludeCodigos = [] }: Props) {
  const { catalogo, isLoading } = useModuloCatalogo(true);

  const items = catalogo.filter((c) => !excludeCodigos.includes(c.codigo));

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((m) => (
          <SelectItem key={m.codigo} value={m.codigo}>
            <div className="flex flex-col">
              <span className="font-medium">{m.label}</span>
              {m.descricao && <span className="text-[10px] text-muted-foreground line-clamp-1">{m.descricao}</span>}
            </div>
          </SelectItem>
        ))}
        {items.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum módulo disponível</div>
        )}
      </SelectContent>
    </Select>
  );
}
