import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TradeSearchBar({ value, onChange, placeholder = "Buscar..." }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-11 h-11 rounded-full bg-card border-border/50 focus-visible:ring-[hsl(330,81%,60%)]/30 focus-visible:border-[hsl(330,81%,60%)]"
      />
    </div>
  );
}
